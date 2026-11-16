import {
	Autocomplete,
	Group,
	Radio,
	SegmentedControl,
	Stack,
	TextInput,
} from "@mantine/core";
import { useObjectCounts } from "@ocelescope/api-base";
import { ObjectPicker, viewParams } from "@ocelescope/core";
import type { ActionKind, ActionPanel } from "../../types/edit";
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
	const { qualifier, objectRelations } = step;
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
				title="Objects to merge"
				viewId={viewId}
				value={step.objects}
				onChange={(objects) => onChange({ ...step, objects })}
			/>
			<ObjectPicker
				label="Copy attributes from (optional)"
				description="The new object takes each attribute once, at the value picked below"
				ocelId={ocelId}
				ocelVersion="original"
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
			<Radio.Group
				label="Qualifier of the new event relations"
				value={qualifier.kind}
				onChange={(kind) =>
					onChange({
						...step,
						qualifier:
							kind === "fixed" ? { kind: "fixed", name: "" } : { kind: "keep" },
					})
				}
			>
				<Group mt="xs" gap="xl" align="flex-start" wrap="nowrap">
					<Radio
						value="keep"
						label="Keep the originals"
						description="One relation per qualifier the merged objects had"
					/>
					<Radio
						value="fixed"
						flex={1}
						miw={0}
						styles={{ labelWrapper: { flex: 1 } }}
						label={
							<TextInput
								size="xs"
								radius={0}
								placeholder="One qualifier for all"
								value={qualifier.kind === "fixed" ? qualifier.name : ""}
								onChange={(e) =>
									onChange({
										...step,
										qualifier: {
											kind: "fixed",
											name: e.currentTarget.value,
										},
									})
								}
							/>
						}
					/>
				</Group>
			</Radio.Group>
			<Radio.Group
				label="O2O relations of the merged objects"
				value={objectRelations}
				onChange={(objectRelations) =>
					onChange({
						...step,
						objectRelations: objectRelations as typeof step.objectRelations,
					})
				}
			>
				<Group mt="xs" gap="xl" align="flex-start" wrap="nowrap">
					<Radio
						value="move"
						label="Move to the new object"
						description="Those between merged objects are dropped"
					/>
					<Radio
						value="drop"
						label="Drop"
						description="They go with the merged objects"
					/>
				</Group>
			</Radio.Group>
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
		qualifier: { kind: "keep" },
		objectRelations: "move",
	}),
	summary: ({ objects, newId }) => (
		<>
			<SelectionName selection={objects} types="objects" />
			{` → ${newId || "new object"}`}
		</>
	),
	validate: ({ newId, objectType, objects, qualifier }) => {
		const objectsError = selectionProblem(objects, "object type");
		return {
			...(!newId.trim() && { newId: "Enter a new object id" }),
			...(!objectType.trim() && { objectType: "Enter an object type" }),
			...(objectsError && { objects: objectsError }),
			...(qualifier.kind === "fixed" &&
				!qualifier.name.trim() && { qualifier: "Enter a qualifier" }),
		};
	},
};
