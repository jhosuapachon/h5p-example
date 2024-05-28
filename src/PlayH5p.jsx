import { H5P } from "h5p-standalone";
import { useEffect, useRef, useState } from "react";
import { isoToMinutesSeconds } from "./utils/time/time";
import { countCorrectAnswers } from "./utils/answers/answers";

const GAME_IDS = {
  VOCABULARY: "vocabulary",
  MEMORY_GAME: "memory-game",
};

const FINISH_STATES = ["completed", "answered"];

function PlayH5p({ h5pJsonPath }) {
  const selectedGame = h5pJsonPath.split("./h5p/")[1];
  const isVocabulary = selectedGame === GAME_IDS.VOCABULARY;

  const h5pContainer = useRef(null);
  const [time, setTime] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);

  useEffect(() => {
    const el = h5pContainer.current;
    const options = {
      h5pJsonPath,
      frameJs: "/assets/frame.bundle.js",
      frameCss: "/assets/h5p.css",
    };

    return () => {
      new H5P(el, options)
        .then(() => {
          window.H5P.externalDispatcher.on("xAPI", function (event) {
            const isCompleted = FINISH_STATES.includes(
              event.data.statement.verb.display["en-US"]
            );
            if (isCompleted) {
              const convertTime = isoToMinutesSeconds(
                event.data.statement.result.duration
              );
              setTime(convertTime);

              if (isVocabulary) {
                const answers = countCorrectAnswers(
                  event.data.statement.result.response,
                  event.data.statement.object.definition
                    .correctResponsesPattern[0]
                );
                setCorrectAnswers(answers);
              }
            }
          });
        })
        .catch((e) => {
          console.log("Error to get content: ", e);
        });
    };
  }, [h5pJsonPath, h5pContainer, isVocabulary]);

  return (
    <div>
      {time !== 0 && (
        <span
          style={{
            fontSize: 20,
          }}
        >
          Tiempo de actividad: {time}
        </span>
      )}
      <div ref={h5pContainer}></div>

      {isVocabulary && <h2>Respuestas correctas: {correctAnswers}</h2>}
    </div>
  );
}

export default PlayH5p;
