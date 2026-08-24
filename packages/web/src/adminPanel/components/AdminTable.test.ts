/** Verifies deterministic ordering independently from the table renderer. */
import { describe, expect, it } from "vitest";
import { sortAdminRows, type AdminTableColumn } from "./AdminTable";

interface Row {
  id: string;
  name: string;
}

const columns: readonly AdminTableColumn<Row>[] = [{
  key: "name",
  label: "Name",
  render: (row) => row.name,
  sortValue: (row) => row.name,
}];

describe("sortAdminRows", () => {
  it("orders the complete row set before a pagination window is selected", () => {
    const rows = [
      { id: "3", name: "Zulu" },
      { id: "1", name: "Alpha" },
      { id: "2", name: "Mike" },
    ];

    const sorted = sortAdminRows(rows, columns, {
      columnKey: "name",
      direction: "ascending",
    });

    expect(sorted.map((row) => row.id)).toEqual(["1", "2", "3"]);
    expect(rows.map((row) => row.id)).toEqual(["3", "1", "2"]);
  });
});
