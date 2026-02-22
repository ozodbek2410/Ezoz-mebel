export function isBirthdayToday(birthday: Date | string): boolean {
  const today = new Date();
  const bday = new Date(birthday);
  return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
}

export function getAge(birthday: Date | string): number {
  const today = new Date();
  const bday = new Date(birthday);
  let age = today.getFullYear() - bday.getFullYear();
  const monthDiff = today.getMonth() - bday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bday.getDate())) {
    age--;
  }
  return age;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
