from datetime import UTC, datetime
from typing import Annotated, Literal, NamedTuple

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
from pydantic import Field

from ocelescope_module_ocel_editor.models.base import BaseResponse
from ocelescope_module_ocel_editor.models.edit.base import (
    EditorActionBase,
    Resources,
)


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
    """A column the new rows need besides their id."""

    name: str
    sql_type: str
    value: str | None
    """The value entered for rows the mapping gives none; ``None`` if not entered."""


def add_entities(
    step: Step,
    resources: Resources,
    entities: IdEntities | MappingEntities,
    table: str,
    id_column: str,
    columns: list[_Column],
) -> None:
    """Add new rows to ``table``, one per id of ``entities``.

    A column takes the mapping's value, or the entered one where the mapping
    has none; with neither, nothing is added. Rows still missing a value, ids the log already has, and ids
    listed with different values are skipped.
    """
    key = ident(id_column)

    if isinstance(entities, IdEntities):
        rows = ", ".join(f"({literal(id)})" for id in entities.ids)
        source = f"(VALUES {rows}) ids({key})"
        available = set()
    else:
        source = resources.table(step, entities.mapping_id, OCELMapping, table)
        available = set(step.sql(f"SELECT * FROM {source} LIMIT 0").columns)

    values = []
    for name, sql_type, entered in columns:
        column = ident(name)
        mapped = f"TRY_CAST({column} AS {sql_type})" if name in available else None
        given = f"CAST({literal(entered)} AS {sql_type})" if entered else None
        if mapped and given:
            value = f"COALESCE({mapped}, {given})"
        elif mapped or given:
            value = mapped or given
        else:
            return
        values.append(f"{value} AS {column}")

    new_rows = (
        f"SELECT DISTINCT {key}, {', '.join(values)} "
        f"FROM {source} WHERE {key} IS NOT NULL"
    )
    has_values = " AND ".join(f"{ident(c.name)} IS NOT NULL" for c in columns)

    added = step.materialize(
        f"added_{table}",
        f"FROM ({new_rows}) "
        f"WHERE {has_values} "
        f"AND {key} NOT IN (SELECT {key} FROM {step[table]}) "
        f"QUALIFY count(*) OVER (PARTITION BY {key}) = 1",
    )

    step[table] = f"FROM {step[table]} UNION ALL BY NAME FROM {added}"


class AddObjects(EditorActionBase):
    """Add new objects to the log."""

    type: Literal["add-objects"]
    entities: NewEntities
    object_type: str | None = Field(default=None, min_length=1)
    """The type of new objects the mapping gives no ``ocel:type``."""

    def build(self, step: Step, resources: Resources) -> None:
        add_entities(
            step,
            resources,
            self.entities,
            OBJECTS_TABLE,
            OID_COL,
            [_Column(OTYPE_COL, "VARCHAR", self.object_type)],
        )


class AddEvents(EditorActionBase):
    """Add new events to the log."""

    type: Literal["add-events"]
    entities: NewEntities
    activity: str | None = Field(default=None, min_length=1)
    """The activity of new events the mapping gives no ``ocel:activity``."""
    timestamp: datetime | None = None
    """The time of new events the mapping gives no ``ocel:timestamp``."""

    def build(self, step: Step, resources: Resources) -> None:
        timestamp = None
        if self.timestamp is not None:
            moment = self.timestamp
            if moment.tzinfo is not None:  # the log stores naive UTC times
                moment = moment.astimezone(UTC).replace(tzinfo=None)
            timestamp = moment.isoformat(sep=" ")

        add_entities(
            step,
            resources,
            self.entities,
            EVENTS_TABLE,
            EID_COL,
            [
                _Column(ACTIVITY_COL, "VARCHAR", self.activity),
                _Column(TIMESTAMP_COL, "TIMESTAMP", timestamp),
            ],
        )
