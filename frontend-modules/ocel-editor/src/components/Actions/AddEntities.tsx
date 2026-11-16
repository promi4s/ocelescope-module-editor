import {
	Autocomplete,
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
			<MappingSelect
				description={`A new ${entity} for each one its ${entity}s table lists`}
				value={value.mappingId}
				onChange={(mappingId) => onChange({ ...value, mappingId })}
			/>
		)}
	</Stack>
);

/** How the mapping's own column fills in for a value left empty. */
const fromMapping = (entities: Entities, column: string) =>
	entities.kind === "mapping"
		? `Leave empty to take each one's from the mapping's ${column} column`
		: undefined;

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
) => (entities.kind === "ids" && !value?.trim() ? message : undefined);

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
				description={fromMapping(step.entities, "ocel:type")}
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
				description={fromMapping(step.entities, "ocel:activity")}
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
				description={fromMapping(step.entities, "ocel:timestamp")}
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
		"Adds new objects: one for each id of a list, or for each object an OCEL mapping lists. A type entered here is every new object's; from a mapping, each takes its ocel:type otherwise. Ids the log already has are refused.",
	Panel: AddObjectsPanel,
	create: () => ({
		type: "add-objects",
		entities: newEntities.ids,
		objectType: null,
	}),
	summary: ({ entities, objectType }) => (
		<>
			<EntitiesName entities={entities} />
			{` → ${objectType || (entities.kind === "mapping" ? "their types" : "type")}`}
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
		"Adds new events: one for each id of a list, or for each event an OCEL mapping lists. An activity or timestamp entered here is every new event's; from a mapping, each takes its ocel:activity and ocel:timestamp otherwise. Ids the log already has are refused.",
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
			{` → ${activity || (entities.kind === "mapping" ? "their activities" : "activity")}`}
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
