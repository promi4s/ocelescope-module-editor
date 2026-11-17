import {
	Collapse,
	Group,
	InlineStyles,
	Stack,
	type StackProps,
	UnstyledButton,
} from "@mantine/core";
import { ActivityPicker, ObjectTypePicker, viewProps } from "@ocelescope/core";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import type {
	IdSelection,
	MappingSelection,
	TypeSelection,
} from "../api/ocelEditor";
import { IdPicker } from "./IdPicker";
import { MappingName, MappingSelect } from "./MappingSelect";
import { ModeMenu } from "./ModeMenu";

export type Selection = TypeSelection | IdSelection | MappingSelection;

export const selections: {
	[K in Selection["kind"]]: Extract<Selection, { kind: K }>;
} = {
	types: { kind: "types", names: [] },
	ids: { kind: "ids", ids: [] },
	mapping: { kind: "mapping", mappingId: "" },
};

const PICKER_CLASS = "ocelescope-editor-type-picker";

const LIST_MAX_HEIGHT = 280;

const MaxHeightStyles = () => (
	<InlineStyles
		deduplicate
		selector={`.${PICKER_CLASS} [role="listbox"]`}
		styles={{ maxHeight: `${LIST_MAX_HEIGHT}px !important` }}
	/>
);

export const SelectionName = ({
	selection,
	types,
}: {
	selection: Selection;
	types: string;
}) => {
	if (selection.kind === "types") {
		return <>{selection.names.join(", ") || types}</>;
	}
	if (selection.kind === "ids") {
		return <>{`${selection.ids.length} ids`}</>;
	}
	return selection.mappingId ? (
		<MappingName id={selection.mappingId} />
	) : (
		<>mapping</>
	);
};

export const selectionProblem = (selection: Selection, type: string) => {
	if (selection.kind === "mapping") {
		return selection.mappingId ? undefined : "Pick an OCEL mapping";
	}
	if (selection.kind === "ids") {
		return selection.ids.length > 0 ? undefined : "Pick at least one id";
	}
	return selection.names.length > 0 ? undefined : `Pick at least one ${type}`;
};

export const SelectionInput = ({
	ocelId,
	entityType,
	title,
	viewId,
	value,
	onChange,
	...props
}: Omit<StackProps, "onChange" | "title"> & {
	ocelId: string;
	entityType: "object" | "event";
	title?: ReactNode;
	viewId: string | null;
	value: Selection;
	onChange: (value: Selection) => void;
}) => {
	const isObject = entityType === "object";
	const Picker = isObject ? ObjectTypePicker : ActivityPicker;
	const [expanded, setExpanded] = useState(true);

	return (
		<Stack gap={4} className={PICKER_CLASS} {...props}>
			<MaxHeightStyles />
			<Group gap={4} wrap="nowrap">
				<UnstyledButton
					flex={1}
					miw={0}
					aria-expanded={expanded}
					onClick={() => setExpanded((expanded) => !expanded)}
				>
					<Group justify="space-between" wrap="nowrap">
						<div>{title}</div>
						<ChevronRight
							size={16}
							style={{
								flex: "none",
								transform: expanded ? "rotate(90deg)" : undefined,
								transition: "transform 150ms ease",
							}}
						/>
					</Group>
				</UnstyledButton>
				<ModeMenu
					label="Select by"
					value={value.kind}
					onChange={(kind) => onChange(selections[kind])}
					options={[
						{ value: "types", label: isObject ? "Object type" : "Activity" },
						{ value: "ids", label: isObject ? "Object ids" : "Event ids" },
						{ value: "mapping", label: "OCEL mapping" },
					]}
				/>
			</Group>
			<Collapse expanded={expanded}>
				{value.kind === "types" ? (
					<Picker
						variant="list"
						multiple
						cutoff
						ocelId={ocelId}
						{...viewProps(viewId)}
						value={value.names}
						onChange={(names) => onChange({ ...value, names })}
					/>
				) : value.kind === "ids" ? (
					<IdPicker
						multiple
						ocelId={ocelId}
						viewId={viewId}
						entityType={entityType}
						value={value.ids}
						onChange={(ids) => onChange({ ...value, ids })}
					/>
				) : (
					<MappingSelect
						label={undefined}
						value={value.mappingId}
						onChange={(mappingId) => onChange({ ...value, mappingId })}
					/>
				)}
			</Collapse>
		</Stack>
	);
};
