import {
	Autocomplete,
	Checkbox,
	Divider,
	SegmentedControl,
	Stack,
	TagsInput,
	TextInput,
} from "@mantine/core";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";
import { viewParams } from "@ocelescope/core";
import type { IdEntities, MappingEntities } from "../../api/ocelEditor";
import type { ActionKind, ActionPanel } from "../../types/edit";
import { MappingName, MappingSelect } from "../MappingSelect";

type Entities = IdEntities | MappingEntities;

const newEntities: {
	[K in Entities["kind"]]: Extract<Entities, { kind: K }>;
} = {
	ids: { kind: "ids", ids: [] },
	mapping: { kind: "mapping", mappingId: "" },
};

const EntitiesInput = ({
	entity,
	value,
	onChange,
}: {
	entity: "object" | "event";
	value: Entities;
	onChange: (value: Entities) => void;
}) => (
	<Stack gap="sm">
		<SegmentedControl
			radius={0}
			value={value.kind}
			onChange={(kind) => onChange(newEntities[kind as Entities["kind"]])}
			data={[
				{ value: "ids", label: "List of ids" },
				{ value: "mapping", label: "From an OCEL mapping" },
			]}
		/>
		{value.kind === "ids" ? (
			<TagsInput
				radius={0}
				label={`New ${entity} ids`}
				description="Type or paste ids; commas, tabs and new lines separate them"
				splitChars={[",", "\n", "\t"]}
				clearable
				value={value.ids}
				onChange={(ids) => onChange({ ...value, ids })}
			/>
		) : (
			<>
				<MappingSelect
					description={`A new ${entity} for each one its ${entity}s table lists`}
					value={value.mappingId}
					onChange={(mappingId) => onChange({ ...value, mappingId })}
				/>
				<Checkbox
					radius={0}
					label="Only use the ids"
					description={`Ignore the mapping's other columns; every new ${entity} gets the values entered below`}
					checked={value.idsOnly ?? false}
					onChange={(e) =>
						onChange({ ...value, idsOnly: e.currentTarget.checked })
					}
				/>
			</>
		)}
	</Stack>
);

/** Whether the values come from the mapping, with the entered ones as fallbacks. */
const fromMappingValues = (entities: Entities) =>
	entities.kind === "mapping" && !entities.idsOnly;

/** How an entered value relates to the mapping's own column. */
const fromMapping = (entities: Entities, entity: string, column: string) =>
	fromMappingValues(entities)
		? `Each ${entity} takes the mapping's ${column}; this is for those without one. Left empty, those are skipped`
		: undefined;

/** What a summary shows for a value: the mapping's, the entered one, or both. */
const valueName = (
	entities: Entities,
	value: string | null | undefined,
	mapped: string,
	missing: string,
) =>
	fromMappingValues(entities)
		? value
			? `${mapped}, else ${value}`
			: mapped
		: value || missing;

const EntitiesName = ({ entities }: { entities: Entities }) => {
	if (entities.kind === "mapping") {
		return entities.mappingId ? (
			<MappingName id={entities.mappingId} />
		) : (
			<>mapping</>
		);
	}
	const { ids } = entities;
	return <>{ids.length <= 3 ? ids.join(", ") || "ids" : `${ids.length} ids`}</>;
};

const entitiesProblem = (entities: Entities) =>
	entities.kind === "mapping"
		? entities.mappingId
			? undefined
			: "Pick an OCEL mapping"
		: entities.ids.length > 0
			? undefined
			: "Enter at least one id";

/** What is missing for a value the ids need and a mapping can fill in. */
const valueProblem = (
	entities: Entities,
	value: string | null | undefined,
	message: string,
) => (!fromMappingValues(entities) && !value?.trim() ? message : undefined);

const sortedKeys = (counts?: Record<string, number>) =>
	Object.keys(counts ?? {}).sort((a, b) => a.localeCompare(b));

const AddObjectsPanel: ActionPanel<"add-objects"> = ({
	ocelId,
	viewId,
	step,
	onChange,
}) => {
	const { data: counts } = useObjectCounts(ocelId, viewParams(viewId));

	return (
		<Stack gap="md">
			<EntitiesInput
				entity="object"
				value={step.entities}
				onChange={(entities) => onChange({ ...step, entities })}
			/>
			<Divider />
			<Autocomplete
				radius={0}
				label="Object type"
				placeholder="Existing or new"
				description={fromMapping(step.entities, "object", "ocel:type")}
				data={sortedKeys(counts)}
				value={step.objectType ?? ""}
				onChange={(objectType) =>
					onChange({ ...step, objectType: objectType || null })
				}
			/>
		</Stack>
	);
};

const AddEventsPanel: ActionPanel<"add-events"> = ({
	ocelId,
	viewId,
	step,
	onChange,
}) => {
	const { data: counts } = useEventCounts(ocelId, viewParams(viewId));

	return (
		<Stack gap="md">
			<EntitiesInput
				entity="event"
				value={step.entities}
				onChange={(entities) => onChange({ ...step, entities })}
			/>
			<Divider />
			<Autocomplete
				radius={0}
				label="Activity"
				placeholder="Existing or new"
				description={fromMapping(step.entities, "event", "ocel:activity")}
				data={sortedKeys(counts)}
				value={step.activity ?? ""}
				onChange={(activity) =>
					onChange({ ...step, activity: activity || null })
				}
			/>
			<TextInput
				radius={0}
				type="datetime-local"
				step={1}
				label="Timestamp"
				description={fromMapping(step.entities, "event", "ocel:timestamp")}
				value={step.timestamp ?? ""}
				onChange={(e) =>
					onChange({ ...step, timestamp: e.currentTarget.value || null })
				}
			/>
		</Stack>
	);
};

export const AddObjects: ActionKind<"add-objects"> = {
	title: "Add Objects",
	description:
		"Adds new objects: one for each id of a list, or for each object an OCEL mapping lists. From a list, or a mapping read for its ids only, every new object gets the type entered here; from a mapping, each takes its ocel:type, and the type entered here only fills in where that is missing. Objects without a type, ids the log already has, and ids the mapping lists with different types are skipped.",
	Panel: AddObjectsPanel,
	create: () => ({
		type: "add-objects",
		entities: newEntities.ids,
		objectType: null,
	}),
	summary: ({ entities, objectType }) => (
		<>
			<EntitiesName entities={entities} />
			{` → ${valueName(entities, objectType, "their types", "type")}`}
		</>
	),
	validate: ({ entities, objectType }) => {
		const entitiesError = entitiesProblem(entities);
		const typeError = valueProblem(
			entities,
			objectType,
			"Enter an object type",
		);
		return {
			...(entitiesError && { entities: entitiesError }),
			...(typeError && { objectType: typeError }),
		};
	},
};

export const AddEvents: ActionKind<"add-events"> = {
	title: "Add Events",
	description:
		"Adds new events: one for each id of a list, or for each event an OCEL mapping lists. From a list, or a mapping read for its ids only, every new event gets the activity and timestamp entered here; from a mapping, each takes its ocel:activity and ocel:timestamp, and the values entered here only fill in where those are missing or not a valid time. Events without an activity or timestamp, ids the log already has, and ids the mapping lists with different values are skipped.",
	Panel: AddEventsPanel,
	create: () => ({
		type: "add-events",
		entities: newEntities.ids,
		activity: null,
		timestamp: null,
	}),
	summary: ({ entities, activity }) => (
		<>
			<EntitiesName entities={entities} />
			{` → ${valueName(entities, activity, "their activities", "activity")}`}
		</>
	),
	validate: ({ entities, activity, timestamp }) => {
		const entitiesError = entitiesProblem(entities);
		const activityError = valueProblem(entities, activity, "Enter an activity");
		const timestampError = valueProblem(
			entities,
			timestamp,
			"Enter a timestamp",
		);
		return {
			...(entitiesError && { entities: entitiesError }),
			...(activityError && { activity: activityError }),
			...(timestampError && { timestamp: timestampError }),
		};
	},
};
