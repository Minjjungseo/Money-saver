"use client";

import { AddMenuSheet } from "@/components/add/AddMenuSheet";
import { ManualTransactionSheet } from "@/components/add/ManualTransactionSheet";
import { ImageImportFlow } from "@/components/add/ImageImportFlow";
import { ImportDataSheet } from "@/components/add/ImportDataSheet";

export function AddFlowSheets() {
  return (
    <>
      <AddMenuSheet />
      <ManualTransactionSheet />
      <ImageImportFlow />
      <ImportDataSheet />
    </>
  );
}
