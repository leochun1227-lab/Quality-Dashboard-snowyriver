// Reference text transcribed from the user's QMS-WAR-003 Version 03 guide.
// These definitions do not remap or reclassify Firebase Issues.
window.PDVFailureGuide = [
  {
    name:'Functional Failure',
    definition:'The component is present and undamaged, but cannot perform its intended function.',
    identify:'Not operating · Intermittent · Reduced performance · Control failure · Abnormal noise or vibration',
    examples:'Light not operating · Water pump not operating · Fridge not cooling',
    exclude:'Physical damage, missing items or incorrect installation.'
  },
  {
    name:'Leakage / Ingress',
    definition:'Water, gas, dust or moisture enters or escapes unintentionally.',
    identify:'Water leak · Gas leak · Plumbing leak · Water, dust or moisture ingress',
    examples:'Roof hatch or window leaking · Gas fitting leaking · Door dust ingress',
    exclude:'Damage or functional failure where no leakage or ingress exists.'
  },
  {
    name:'Configuration / Fitment Defect',
    definition:'The component is installed, assembled, aligned, adjusted or configured incorrectly.',
    identify:'Misalignment · Uneven gaps · Poor fitment · Incorrect adjustment · Debris or excess sealant',
    examples:'Entry door misaligned · Incorrect wheel alignment · Metal shavings left behind',
    exclude:'Physical damage, missing items or a primary functional failure.'
  },
  {
    name:'Damage',
    definition:'The component has physically lost its integrity or original form.',
    identify:'Cracked · Fractured · Broken · Bent · Deformed · Separated · Delaminated · Impact damage',
    examples:'Light lens cracked · Suspension bracket damaged · Table or shower door damaged',
    exclude:'Appearance-only concerns, missing items or incorrect installation.'
  },
  {
    name:'Wear & Deterioration',
    definition:'The component has degraded gradually through normal use or environmental exposure.',
    identify:'Wear · Fatigue · Corrosion · Seal degradation · UV deterioration · Surface ageing',
    examples:'Door or window seal deteriorated · Hinge or runner worn · Corrosion or surface rust',
    exclude:'Impact damage, incorrect installation or missing items.'
  },
  {
    name:'Cosmetic Defect',
    definition:'The issue affects appearance only — not function, safety or compliance.',
    identify:'Surface blemish · Colour variation · Paint defect · Finish inconsistency · Minor appearance concern',
    examples:'Decal wrinkle or bubble · Paint imperfection · Interior surface mark',
    exclude:'Functional failure, structural damage, safety, compliance or missing items.'
  },
  {
    name:'Missing',
    definition:'A required component, item, accessory, hardware or safety device is physically absent.',
    identify:'Missing component · Missing hardware · Missing accessory · Missing safety equipment',
    examples:'Fire extinguisher or smoke alarm missing · Wheel nut or shim missing · Compliance label missing',
    exclude:'Items that are present but loose, incorrectly fitted or damaged.'
  }
];
