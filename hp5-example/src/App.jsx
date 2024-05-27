import { useState } from "react";
import "./App.css";
import PlayH5p from "./PlayH5p";

function App() {
  const [selectedActivity, setSelectedActivity] = useState("vocabulary");

  const onChangeSelectedActivity = (activity) => setSelectedActivity(activity);

  return (
    <>
      <h1>H5P Example</h1>
      <div style={{ display: "flex", gap: "0.2rem", marginBottom: "1rem" }}>
        <button onClick={() => onChangeSelectedActivity("memory-game")}>
          Memory Game
        </button>
        <button onClick={() => onChangeSelectedActivity("vocabulary")}>
          Vocabulary
        </button>
      </div>
      <PlayH5p
        key={selectedActivity}
        h5pJsonPath={`./h5p/${selectedActivity}`}
      />
    </>
  );
}

export default App;
