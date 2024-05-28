export function countCorrectAnswers(userResponse, correctPattern) {
  const userPairs = userResponse.split(",").map((pair) => pair.trim());
  const correctPairs = correctPattern.split(",").map((pair) => pair.trim());

  let correctCount = 0;
  for (let userPair of userPairs) {
    if (correctPairs.includes(userPair)) {
      correctCount++;
    }
  }

  return correctCount;
}
