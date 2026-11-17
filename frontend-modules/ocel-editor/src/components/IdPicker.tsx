import { useDebouncedValue } from "@mantine/hooks";
import {
	useEventCounts,
	useEventIds,
	useObjectCounts,
	useObjectIds,
} from "@ocelescope/api-base";
import {
	OptionPicker,
	type OptionPickerProps,
	viewParams,
} from "@ocelescope/core";
import { useMemo, useState } from "react";

const SEARCH_DELAY_MS = 300;

/** `Omit` that keeps a union a union, so single and multiple selection stay apart. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
	? Omit<T, K>
	: never;

export type IdPickerProps = DistributiveOmit<
	OptionPickerProps<string>,
	"options" | "search" | "onSearch" | "total" | "loading" | "error"
> & {
	ocelId: string;
	/** The view of the steps before; `null` for the original log. */
	viewId: string | null;
	entityType: "object" | "event";
	/** How many ids a search turns up. */
	limit?: number;
};

/**
 * The ids of a log's objects or events, as the steps before leave it.
 *
 * Stands in for core's `ObjectPicker` / `EventPicker`, which take a `viewId`
 * but don't read from it (`@ocelescope/core` 0.13.0); it can go once they do.
 */
export const IdPicker = ({
	ocelId,
	viewId,
	entityType,
	limit = 50,
	...picker
}: IdPickerProps) => {
	const isObject = entityType === "object";
	const [search, setSearch] = useState("");
	const [debounced] = useDebouncedValue(search, SEARCH_DELAY_MS);
	const source = viewParams(viewId);
	const params = { ...source, search: debounced || undefined, size: limit };

	const objectIds = useObjectIds(ocelId, params, {
		query: { enabled: isObject },
	});
	const eventIds = useEventIds(ocelId, params, {
		query: { enabled: !isObject },
	});
	const objectCounts = useObjectCounts(ocelId, source, {
		query: { enabled: isObject },
	});
	const eventCounts = useEventCounts(ocelId, source, {
		query: { enabled: !isObject },
	});
	const ids = isObject ? objectIds : eventIds;
	const counts = isObject ? objectCounts : eventCounts;

	const total = useMemo(
		() =>
			counts.data
				? Object.values(counts.data).reduce((sum, n) => sum + n, 0)
				: undefined,
		[counts.data],
	);
	const options = useMemo(
		() => (ids.data?.response ?? []).map((id) => ({ value: id, label: id })),
		[ids.data],
	);

	return (
		<OptionPicker
			options={options}
			search={search}
			onSearch={setSearch}
			total={total}
			loading={ids.isFetching}
			error={ids.error}
			placeholder={`Search for an ${entityType}…`}
			emptyText={`No ${entityType} matches`}
			sort="name"
			counts={false}
			bars={false}
			{...picker}
		/>
	);
};
