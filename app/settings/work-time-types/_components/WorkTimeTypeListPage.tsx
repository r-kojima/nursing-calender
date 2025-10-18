import { getWorkTimeTypes } from "../_lib/getWorkTimeTypes";
import { WorkTimeTypeListClient } from "./WorkTimeTypeListClient";

export async function WorkTimeTypeListPage() {
  const workTimeTypes = await getWorkTimeTypes();

  return <WorkTimeTypeListClient workTimeTypes={workTimeTypes} />;
}
