from typing import Annotated, TypeAlias

from pydantic import Field

from ocelescope_module_ocel_editor.models.edit.add_entities import (
    AddEvents,
    AddObjects,
)
from ocelescope_module_ocel_editor.models.edit.add_relations import AddE2O, AddO2O
from ocelescope_module_ocel_editor.models.edit.base import (
    Edit,
    EditorActionBase,
    Resources,
)
from ocelescope_module_ocel_editor.models.edit.merge_objects import MergeObjects
from ocelescope_module_ocel_editor.models.edit.type_rename import (
    ActivityRename,
    ObjectTypeRename,
)

EditorAction: TypeAlias = Annotated[
    ObjectTypeRename
    | ActivityRename
    | AddObjects
    | AddEvents
    | AddE2O
    | AddO2O
    | MergeObjects,
    Field(discriminator="type"),
]

__all__ = [
    "ActivityRename",
    "AddE2O",
    "AddEvents",
    "AddO2O",
    "AddObjects",
    "Edit",
    "EditorAction",
    "EditorActionBase",
    "MergeObjects",
    "ObjectTypeRename",
    "Resources",
]
