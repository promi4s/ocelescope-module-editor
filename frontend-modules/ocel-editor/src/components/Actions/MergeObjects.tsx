import {
	Autocomplete,
	Group,
	SegmentedControl,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useObjectCounts } from "@ocelescope/api-base";
import { viewParams } from "@ocelescope/core";
import type { ActionKind, ActionPanel } from "../../types/edit";
import { IdPicker } from "../IdPicker";
import {
	SelectionInput,
	SelectionName,
	selectionProblem,
	selections,
} from "../SelectionInput";

const MergeObjectsPanel: ActionPanel<"merge-objects"> = ({
	ocelId,
	step,
	onChange,
	viewId,
}) => {
	const { qualifier } = step;
	const { data: counts } = useObjectCounts(ocelId, viewParams(viewId));
	const types = Object.keys(counts ?? {}).sort((a, b) => a.localeCompare(b));

	return (
		<Stack gap="md">
			<Group gap="sm" align="flex-end" wrap="nowrap">
				<TextInput
					flex={1}
					miw={0}
					radius={0}
					label="New object id"
					value={step.newId}
					onChange={(e) => onChange({ ...step, newId: e.currentTarget.value })}
				/>
				<Autocomplete
					flex={1}
					miw={0}
					radius={0}
					label="Object type"
					placeholder="Existing or new"
					data={types}
					value={step.objectType}
					onChange={(objectType) => onChange({ ...step, objectType })}
				/>
			</Group>
			<SelectionInput
				ocelId={ocelId}
				entityType="object"
				title={
					<Text size="sm" fw={500}>
						Objects to merge
					</Text>
				}
				viewId={viewId}
				value={step.objects}
				onChange={(objects) => onChange({ ...step, objects })}
			/>
			<IdPicker
				label="Copy attributes from (optional)"
				description="The new object takes each attribute once, at the value picked below"
				ocelId={ocelId}
				viewId={viewId}
				entityType="object"
				value={step.copyFrom}
				onChange={(copyFrom) => onChange({ ...step, copyFrom })}
			/>
			{step.copyFrom && (
				<SegmentedControl
					radius={0}
					value={step.copyAt ?? "start"}
					onChange={(copyAt) =>
						onChange({ ...step, copyAt: copyAt as "start" | "end" })
					}
					data={[
						{ value: "start", label: "Values at initialization" },
						{ value: "end", label: "Values at the end" },
					]}
				/>
			)}
			<TextInput
				radius={0}
				label="Qualifier of the new event relations (optional)"
				description="One relation to each event any merged object had"
				value={qualifier ?? ""}
				onChange={(e) =>
					onChange({ ...step, qualifier: e.currentTarget.value || null })
				}
			/>
		</Stack>
	);
};

export const MergeObjects: ActionKind<"merge-objects"> = {
	title: "Merge Objects",
	description:
		"Replaces the selected objects by one new object, related to every event any of them is. The merged objects are removed afterwards.",
	Panel: MergeObjectsPanel,
	create: () => ({
		type: "merge-objects",
		newId: "",
		objectType: "",
		objects: selections.ids,
	}),
	summary: ({ objects, newId }) => (
		<>
			<SelectionName selection={objects} types="objects" />
			{` → ${newId || "new object"}`}
		</>
	),
	validate: ({ newId, objectType, objects }) => {
		const objectsError = selectionProblem(objects, "object type");
		return {
			...(!newId.trim() && { newId: "Enter a new object id" }),
			...(!objectType.trim() && { objectType: "Enter an object type" }),
			...(objectsError && { objects: objectsError }),
		};
	},
};
