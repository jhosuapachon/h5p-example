export function isoToMinutesSeconds(isoString) {
  const seconds = parseInt(isoString.match(/\d+/)[0], 10);

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  // Form string HH:MM
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}
