from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Annotated, ClassVar, Literal, NamedTuple, Self

from ocelescope import OCELMapping
from ocelescope.ocel.constants import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.view import Step
from ocelescope.util.sql import ident, literal
from pydantic import Field, model_validator

from ocelescope_module_ocel_editor.models.base import BaseResponse
from ocelescope_module_ocel_editor.models.edit.base import (
    EditorActionBase,
    Resources,
)

_MAX_LISTED = 10


class IdEntities(BaseResponse):
    """A new entity for each of these ids."""

    kind: Literal["ids"]
    ids: list[str] = Field(min_length=1)


class MappingEntities(BaseResponse):
    """A new entity for each one an ``OCELMapping`` lists."""

    kind: Literal["mapping"]
    mapping_id: str


NewEntities = Annotated[IdEntities | MappingEntities, Field(discriminator="kind")]


class _Column(NamedTuple):
    """A column the new entities need besides their id."""

    name: str
    what: str
    article: str
    sql_type: str
    given: str | None
    """SQL for the value every new entity gets; ``None`` to read the mapping's."""


def _listed(ids: list[str]) -> str:
    shown = ", ".join(ids[:_MAX_LISTED])
    rest = len(ids) - _MAX_LISTED
    return f"{shown} and {rest} more" if rest > 0 else shown


class _AddEntities(EditorActionBase, ABC):
    """Add new entities to the log.

    Their ids come from a list or an OCEL mapping. A value entered for a column
    (the type, an event's timestamp) is every new entity's; left out, each takes
    the one its row of the mapping has in that column. Ids must be new to the
    log, and an id the mapping lists twice must have the same values both times.
    """

    table: ClassVar[str]
    id_column: ClassVar[str]
    entity: ClassVar[str]

    entities: NewEntities

    @abstractmethod
    def _columns(self) -> list[_Column]:
        """The columns the new entities need besides their id."""

    @model_validator(mode="after")
    def _ids_have_values(self) -> Self:
        if isinstance(self.entities, IdEntities):
            missing = [
                f"{column.article} {column.what}"
                for column in self._columns()
                if not column.given
            ]
            if missing:
                raise ValueError(
                    f"New {self.entity}s from ids need {' and '.join(missing)}"
                )
        return self

    def build(self, step: Step, resources: Resources) -> None:
        added = step.materialize(f"added_{self.table}", self._new_rows(step, resources))
        self._check(step, added)
        step[self.table] = f"FROM {step[self.table]} UNION ALL BY NAME FROM {added}"

    def _new_rows(self, step: Step, resources: Resources) -> str:
        key = ident(self.id_column)
        columns = self._columns()

        if isinstance(self.entities, IdEntities):
            rows = ", ".join(f"({literal(id)})" for id in self.entities.ids)
            source = f"(VALUES {rows}) ids({key})"
        else:
            source = resources.table(
                step, self.entities.mapping_id, OCELMapping, self.table
            )
            available = step.sql(f"SELECT * FROM {source} LIMIT 0").columns
            for column in columns:
                if column.given is None and column.name not in available:
                    raise ValueError(
                        f"The mapping has no {column.name} column: enter "
                        f"{column.article} {column.what} for the new {self.entity}s"
                    )

        values = "".join(
            f", {column.given or f'TRY_CAST({ident(column.name)} AS {column.sql_type})'}"
            f" AS {ident(column.name)}"
            for column in columns
        )
        return f"SELECT DISTINCT {key}{values} FROM {source} WHERE {key} IS NOT NULL"

    def _check(self, step: Step, added: str) -> None:
        key = ident(self.id_column)

        def ids(condition: str) -> list[str]:
            return [
                id
                for (id,) in step.sql(
                    f"SELECT DISTINCT {key} FROM {added} WHERE {condition} ORDER BY 1"
                ).fetchall()
            ]

        if not step.sql(f"SELECT 1 FROM {added} LIMIT 1").fetchall():
            raise ValueError(f"The mapping lists no {self.entity}s")

        twice = ids(
            f"{key} IN (SELECT {key} FROM {added} GROUP BY {key} HAVING count(*) > 1)"
        )
        if twice:
            whats = " or ".join(column.what for column in self._columns())
            raise ValueError(
                f"These ids are listed with different values of {whats}: {_listed(twice)}"
            )

        for column in self._columns():
            missing = ids(f"{ident(column.name)} IS NULL")
            if missing:
                raise ValueError(
                    f"These {self.entity}s have no {column.what} in the mapping"
                    + (
                        ", or one that is not a time"
                        if column.sql_type == "TIMESTAMP"
                        else ""
                    )
                    + f"; enter one for all: {_listed(missing)}"
                )

        taken = ids(f"{key} IN (SELECT {key} FROM {step[self.table]})")
        if taken:
            raise ValueError(f"These ids are already in the log: {_listed(taken)}")


class AddObjects(_AddEntities):
    type: Literal["add-objects"]
    object_type: str | None = Field(default=None, min_length=1)
    """Every new object's type; left out, each takes the mapping's ``ocel:type``."""

    table = OBJECTS_TABLE
    id_column = OID_COL
    entity = "object"

    def _columns(self) -> list[_Column]:
        given = literal(self.object_type) if self.object_type else None
        return [_Column(OTYPE_COL, "type", "a", "VARCHAR", given)]


class AddEvents(_AddEntities):
    type: Literal["add-events"]
    activity: str | None = Field(default=None, min_length=1)
    """Every new event's activity; left out, each takes the mapping's ``ocel:activity``."""
    timestamp: datetime | None = None
    """Every new event's time; left out, each takes the mapping's ``ocel:timestamp``."""

    table = EVENTS_TABLE
    id_column = EID_COL
    entity = "event"

    def _columns(self) -> list[_Column]:
        activity = literal(self.activity) if self.activity else None
        timestamp = None
        if self.timestamp is not None:
            moment = self.timestamp
            if moment.tzinfo is not None:
                moment = moment.astimezone(UTC).replace(tzinfo=None)
            timestamp = f"CAST({literal(moment.isoformat(sep=' '))} AS TIMESTAMP)"
        return [
            _Column(ACTIVITY_COL, "activity", "an", "VARCHAR", activity),
            _Column(TIMESTAMP_COL, "timestamp", "a", "TIMESTAMP", timestamp),
        ]
