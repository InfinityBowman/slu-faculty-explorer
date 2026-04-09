import variant from '@jitl/quickjs-singlefile-browser-release-sync'
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import type { QuickJSWASMModule } from 'quickjs-emscripten-core'
import type { Faculty } from '@/lib/types'

let modulePromise: Promise<QuickJSWASMModule> | null = null
function getQuickJS(): Promise<QuickJSWASMModule> {
  if (!modulePromise) {
    modulePromise = newQuickJSWASMModuleFromVariant(variant)
  }
  return modulePromise
}

const TIMEOUT_MS = 5000

// Slim down faculty objects before serializing into the VM — drop large text
// fields (researchInterests, bio blobs) to keep the JSON transfer fast.
function slimFaculty(faculty: Array<Faculty>) {
  return faculty.map((f) => ({
    id: f.id,
    name: f.name,
    school: f.school,
    department: f.department,
    hIndex: f.hIndex,
    hIndex5y: f.hIndex5y,
    i10Index: f.i10Index,
    i10Index5y: f.i10Index5y,
    citations: f.citations,
    citations5y: f.citations5y,
    openalexHIndex: f.openalexHIndex,
    openalexCitations: f.openalexCitations,
    openalexWorksCount: f.openalexWorksCount,
    openalex2yrFwci: f.openalex2yrFwci,
    openalexFirstYear: f.openalexFirstYear,
    openalexLastYear: f.openalexLastYear,
    openalexField: f.openalexField,
    openalexSubfield: f.openalexSubfield,
    openalexTopTopic: f.openalexTopTopic,
    primaryHTier: f.primaryHTier,
    fieldHPercentile: f.fieldHPercentile,
    subfieldHPercentile: f.subfieldHPercentile,
    deptHPercentile: f.deptHPercentile,
    adminRole: f.adminRole,
    phdYear: f.phdYear,
    phdInstitution: f.phdInstitution,
  }))
}

export async function executeCode(
  code: string,
  faculty: Array<Faculty>,
): Promise<unknown> {
  const qjs = await getQuickJS()
  const vm = qjs.newContext()

  try {
    // Time-based interrupt: kill execution after TIMEOUT_MS
    const deadline = Date.now() + TIMEOUT_MS
    vm.runtime.setInterruptHandler(() => Date.now() > deadline)

    // Inject the faculty data as a JSON string global
    const dataHandle = vm.newString(JSON.stringify(slimFaculty(faculty)))
    vm.setProp(vm.global, 'dataJson', dataHandle)
    dataHandle.dispose()

    // Wrap the user code: parse the data, execute the code body, stringify result
    const wrapped = `
      const data = JSON.parse(dataJson);
      const __result = (function() { ${code} })();
      JSON.stringify(__result);
    `

    const result = vm.evalCode(wrapped)

    if (result.error) {
      const errObj = vm.dump(result.error)
      result.error.dispose()
      const message =
        typeof errObj === 'object' && errObj?.message
          ? String(errObj.message)
          : String(errObj)
      throw new Error(message)
    }

    const json = vm.dump(result.value)
    result.value.dispose()

    return typeof json === 'string' ? JSON.parse(json) : json
  } finally {
    vm.dispose()
  }
}
