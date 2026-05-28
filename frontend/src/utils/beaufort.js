export const BFT_TABLE = [
  { min: 0,   bft: 0,  desc: "Windstille" },
  { min: 1,   bft: 1,  desc: "Leiser Zug" },
  { min: 6,   bft: 2,  desc: "Leichte Brise" },
  { min: 12,  bft: 3,  desc: "Schwache Brise" },
  { min: 20,  bft: 4,  desc: "Mäßige Brise" },
  { min: 29,  bft: 5,  desc: "Frische Brise" },
  { min: 39,  bft: 6,  desc: "Starker Wind" },
  { min: 50,  bft: 7,  desc: "Steifer Wind" },
  { min: 62,  bft: 8,  desc: "Stürmischer Wind ⚠" },
  { min: 75,  bft: 9,  desc: "Sturm ⚠" },
  { min: 89,  bft: 10, desc: "Schwerer Sturm ⚠" },
  { min: 103, bft: 11, desc: "Orkanartiger Sturm ⚠" },
  { min: 117, bft: 12, desc: "Orkan ⚠" },
]

export function kmhToBeaufort(kmh) {
  let bft = 0
  for (const { min, bft: b } of BFT_TABLE) {
    if (kmh >= min) bft = b
    else break
  }
  return bft
}

export function beaufortColor(bft) {
  if (bft >= 12) return '#4a0000'
  if (bft >= 11) return '#7b0000'
  if (bft >= 10) return '#a94442'
  if (bft >= 9)  return '#d9534f'
  if (bft >= 8)  return '#f0ad4e'
  return '#5bc0de'
}

export function beaufortLabel(bft) {
  const entry = BFT_TABLE.find(e => e.bft === bft)
  return entry ? entry.desc : `Bft ${bft}`
}
