const audio = new AudioStream();
const scope = new Oscilloscope('scope', audio);
const bpmCounter = new BpmCounter(audio);
