import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDocumentRejectionReason } from "../src/modules/hr/utils/document-rejection.ts";

test("document rejection requires a meaningful reason including whitespace-only input", () => {
  for (const reason of ["", " ", "\n\t", "\u00a0"]) {
    assert.throws(() => normalizeDocumentRejectionReason(reason), /Informe o motivo/);
  }
});

test("document rejection preserves accents, punctuation and multiline explanations", () => {
  assert.equal(
    normalizeDocumentRejectionReason(" \nArquivo ilegível.\nReenviar a página 2, por favor. \t"),
    "Arquivo ilegível.\nReenviar a página 2, por favor.",
  );
});
