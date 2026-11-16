# TODO LIST

## Editor

- [x] umbenennen von aktivitäten & objekttypen

  - [x] attribute wert als type notion für alle wo der wert nicht NA ist (toggle NA droppen oder as is)

- [ ] trace-merger: ich gebe als input 1) setes von objekten und eine object id (darf nicht vorhanden sein (mapping: new object id -> set objects) und 2) ein mapping neue IDs + object type (darf schon vorhanden sein) und 3) (optional) eine vorhandene obvject ID von der die attribute kopiert werden (neue id auf altes object). für jede neue ID: für alle events in die mindestens eines der objekte im set involviert ist fügen wir ein neues objekt mit neuer object id, vom neuen object type und attribute werten vom optonalen koperten objekt hinzu.

- [x] Add o2o relations und add E2O relations.

- [x] Add new object/add new event

# OCEL Editor

## Actions

### Rename Object Type / Activities

- **Input**

  - Selection of objects or events
    - List of object types/activities selection all objects or activities of that type

    - List of (event|object) ids

    - OCEL Mapping

      - In this case we only use the tables for events and objects as a alternative list for inputing event or object ids

      - It also allows the input of a csv that gets turned into a ocel mapping meaning a csv with event ids under a ocel:eid column or a csv of object ids with a ocel:oid column

  - Selection of new object type or activity

    - Static name renaming all selected object and events in (1) with the same givien name

    - Attribute value: Allowing to select a attribute value

      - Fallthoroughs:

        - Keep Type, keep the old activite or object type if the attribute is null
        - Drop, Drop the events and objects which have no attribute also removing the events
        - Fallback name: Allows to give a fallback name for events or objects that have no attribute

- **How it works details**:
  - **static:** Rename the types of each of the selected ids with the static name else the use their old name
  - **attibutes**: For attributes the last value is used.
