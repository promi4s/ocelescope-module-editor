from typing import Literal

from ocelescope.ocel.constants import (
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.ocel.view import Step
from ocelescope.util.sql import ident, literal
from pydantic import Field

from ocelescope_module_ocel_editor.models.edit.base import (
    EditorActionBase,
    Resources,
)
from ocelescope_module_ocel_editor.models.edit.selection import (
    Selection,
    selection_condition,
)


class MergeObjects(EditorActionBase):
    """Replace the selected objects by one new object.

    ``new_id`` must not be in the log; ``object_type`` may be. The new object is
    related to every event any selected object is, and the selected objects are
    gone afterwards. Their O2O relations move to the new object, except those
    between two selected objects, which would loop on it. The new object takes
    each attribute of ``copy_from``, if given, once: at its first or last value,
    as ``copy_at`` says, under the timestamp of that value.
    """

    type: Literal["merge-objects"]
    new_id: str = Field(min_length=1)
    object_type: str = Field(min_length=1)
    objects: Selection
    copy_from: str | None = None
    copy_at: Literal["start", "end"] = "start"
    qualifier: str | None = None
    """The qualifier of the new object's event relations, if any."""

    def build(self, step: Step, resources: Resources) -> None:
        self._check_ids(step)
        members = self._members(step, resources)
        self._merge_e2o(step, members)
        self._merge_o2o(step, members)
        self._merge_changes(step, members)
        self._merge_objects(step, members)

    def _exists(self, step: Step, id: str) -> bool:
        return (
            step.sql(
                f"SELECT 1 FROM {step[OBJECTS_TABLE]} "
                f"WHERE {ident(OID_COL)} = {literal(id)} LIMIT 1"
            ).fetchone()
            is not None
        )

    def _check_ids(self, step: Step) -> None:
        if self._exists(step, self.new_id):
            raise ValueError(f"The new id is already in the log: {self.new_id}")
        if self.copy_from and not self._exists(step, self.copy_from):
            raise ValueError(f"The object to copy from is gone: {self.copy_from}")

    def _members(self, step: Step, resources: Resources) -> str:
        """Store the oids of the objects to merge."""
        oid = ident(OID_COL)
        condition = selection_condition(
            step, resources, self.objects, OBJECTS_TABLE, OID_COL, OTYPE_COL
        )
        members = step.materialize(
            "merge_members",
            f"SELECT {oid} FROM {step[OBJECTS_TABLE]} WHERE {condition}",
        )
        if step.sql(f"SELECT 1 FROM {members} LIMIT 1").fetchone() is None:
            raise ValueError("The merge selects no objects")
        return members

    def _merge_e2o(self, step: Step, members: str) -> None:
        eid, oid = ident(EID_COL), ident(OID_COL)
        qualifier = ident(E2O_QUALIFIER)
        new_id = literal(self.new_id)
        merged_qualifier = literal(self.qualifier) if self.qualifier else "NULL"
        added = step.materialize(
            "merged_e2o",
            f"""
            SELECT DISTINCT r.{eid}, {new_id} AS {oid}, {merged_qualifier} AS {qualifier}
            FROM {step[E2O_TABLE]} r
            WHERE r.{oid} IN (SELECT {oid} FROM {members})
            """,
        )
        step[E2O_TABLE] = f"""
            SELECT * FROM {step[E2O_TABLE]}
            WHERE {oid} NOT IN (SELECT {oid} FROM {members})
            UNION ALL BY NAME FROM {added}
        """

    def _merge_o2o(self, step: Step, members: str) -> None:
        oid = ident(OID_COL)
        source, target = ident(O2O_SOURCE_ID), ident(O2O_TARGET_ID)
        qualifier = ident(O2O_QUALIFIER)
        kept = f"""
            SELECT * FROM {step[O2O_TABLE]}
            WHERE {source} NOT IN (SELECT {oid} FROM {members})
            AND {target} NOT IN (SELECT {oid} FROM {members})
        """
        new_id = literal(self.new_id)
        merged = f"IN (SELECT {oid} FROM {members})"
        moved = step.materialize(
            "merged_o2o",
            f"""
            SELECT DISTINCT
                CASE WHEN r.{source} {merged} THEN {new_id} ELSE r.{source} END
                    AS {source},
                CASE WHEN r.{target} {merged} THEN {new_id} ELSE r.{target} END
                    AS {target},
                r.{qualifier}
            FROM {step[O2O_TABLE]} r
            WHERE (r.{source} {merged}) <> (r.{target} {merged})
            """,
        )
        step[O2O_TABLE] = f"{kept} UNION ALL BY NAME FROM {moved}"

    def _merge_changes(self, step: Step, members: str) -> None:
        oid, timestamp = ident(OID_COL), ident(TIMESTAMP_COL)
        kept = f"""
            SELECT * FROM {step[OBJECT_CHANGES_TABLE]}
            WHERE {oid} NOT IN (SELECT {oid} FROM {members})
        """
        if not self.copy_from:
            step[OBJECT_CHANGES_TABLE] = kept
            return

        copied = step.materialize(
            "merged_changes",
            f"""
            SELECT * REPLACE ({literal(self.new_id)} AS {oid})
            FROM {step[OBJECT_CHANGES_TABLE]}
            WHERE {oid} = {literal(self.copy_from)}
            QUALIFY row_number() OVER (
                PARTITION BY {ident(OBJECT_CHANGED_FIELD)}
                ORDER BY {timestamp} {"ASC" if self.copy_at == "start" else "DESC"}
            ) = 1
            """,
        )
        step[OBJECT_CHANGES_TABLE] = f"{kept} UNION ALL BY NAME FROM {copied}"

    def _merge_objects(self, step: Step, members: str) -> None:
        oid, otype = ident(OID_COL), ident(OTYPE_COL)
        step[OBJECTS_TABLE] = f"""
            SELECT * FROM {step[OBJECTS_TABLE]}
            WHERE {oid} NOT IN (SELECT {oid} FROM {members})
            UNION ALL BY NAME
            SELECT {literal(self.new_id)} AS {oid}, {literal(self.object_type)} AS {otype}
        """
