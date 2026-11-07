export function formatAccountName(value) {
  if (value === null || value === undefined) return value;

  let name = String(value).trim().replace(/\s+/g, " ");
  if (!name) return name;

  if (name.includes("@")) return name;

  if (!name.includes(" ")) {
    name = name
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  }

  return name
    .split(" ")
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}

function capitalizeWord(word) {
  return word
    .split(/([-'’])/)
    .map((part) => {
      if (!part || part === "-" || part === "'" || part === "’") return part;
      return capitalizePart(part);
    })
    .join("");
}

function capitalizePart(part) {
  const lower = part.toLowerCase();
  const upper = part.toUpperCase();

  if (part !== lower && part !== upper) {
    return part;
  }

  return part.charAt(0).toUpperCase() + lower.slice(1);
}

export default formatAccountName;
