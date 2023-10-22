// Object storing sample categories and their respective samples.
const categories = {
    bass: [
        {src: "audio/bass/bass low.mp3", name: "Bass Low"},
        {src: "audio/bass/bass Hip-hop.mp3", name: "Bass Hip-hop"},
        {src: "audio/bass/bass solo.mp3", name: "Bass Solo"}
    ],
    drum: [
        {src: "audio/drum/drum war.mp3", name: "Drum Solo"},
        {src: "audio/drum/drum set.mp3", name: "Drum Set"},
        {src: "audio/drum/e-drum.mp3", name: "E-Drum"}
    ],
    guitar: [
        {src: "audio/guitar/guitar easy.mp3", name: "Guitar Easy"},
        {src: "audio/guitar/guitar slow.mp3", name: "Guitar Slow"},
        {src: "audio/guitar/guitar fast.mp3", name: "Guitar Fast"}
    ],
    piano: [
        {src: "audio/piano/E-piano.mp3", name: "E-Piano"},
        {src: "audio/piano/piano warm.mp3", name: "Piano Warm"},
        {src: "audio/piano/piano arpegg.mp3", name: "Piano Solo"}
    ],
    violin: [
        {src: "audio/violin/violin sad.mp3", name: "Violin Mournful"},
        {src: "audio/violin/violin solo.mp3", name: "Violin Solo"}
    ]
};

// Define global variables for tracks, audio settings, and UI states.
let tracks = [];
let activeAudio = [];
let isPlaying = false;
let volumes = [];
let trackLoopingStatus = [];
let mmediaRecorder;
let audioChunks = [];
let audioContext;
let startTime;
let animationFrameId;
let timeoutIds = [];
let currentStream = null;
let elapsedTime = 0; 
let timerInterval = null; 

// Attempt to create an AudioContext for playback and recording. 
try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    alert('Web Audio API is not supported in this browser');
}

// Reference to HTML elements for UI controls and displays.
const addButtons = document.getElementById("addButtons");
const tracksDiv = document.getElementById("tracks");
const playButton = document.getElementById("play");
const addTrackButton = document.getElementById("addTrack");
const uploadButton = document.getElementById("upload");
const fileInput = document.getElementById("input-sample");
const startRecordingButton = document.getElementById("startRecording");
const stopRecordingButton = document.getElementById("stopRecording");
const saveRecordingButton = document.getElementById("saveRecording");
const recordedSampleNameInput = document.getElementById("recordedSampleName");
const trackLine = document.querySelector(".track-line");
const MAX_DURATION_SECONDS = 10 * 60;
const PIXELS_PER_SECOND = 25;

// Function to create a button for each sample.
function createSampleButton(sample, id) {
    const button = document.createElement("button");
    button.setAttribute("data-id", id);
    button.setAttribute("draggable", "true");
    button.innerText = sample.name;
        button.addEventListener("dragstart", event => {
        event.dataTransfer.setData("sampleIndex", id);
    });
    
    addButtons.appendChild(button);
    addButtons.appendChild(button);
}

// Initialize sample buttons for all categories.
function initializeSampleButtons() {
    Object.entries(categories).forEach(([categoryName, categorySamples]) => {
        const categoryDropdown = document.createElement("div");
        categoryDropdown.className = "category-dropdown";

        const categoryButton = document.createElement("button");
        
        categoryButton.innerText = categoryName + " ▼"; 
        categoryButton.addEventListener("click", () => {
            categoryDropdown.classList.toggle("open");
        });
        categoryDropdown.appendChild(categoryButton);

        const samplesDiv = document.createElement("div");
        samplesDiv.className = "samples";
        categorySamples.forEach((sample, sampleIndex) => {
            const sampleButton = document.createElement("button");
            sampleButton.setAttribute("data-category-name", categoryName);
            sampleButton.setAttribute("data-sample-index", sampleIndex);
            sampleButton.setAttribute("draggable", "true");
            sampleButton.innerText = sample.name;
            sampleButton.addEventListener("dragstart", event => {
                event.dataTransfer.setData("categoryName", categoryName);
                event.dataTransfer.setData("sampleIndex", sampleIndex);
            });
            samplesDiv.appendChild(sampleButton);
        });
        categoryDropdown.appendChild(samplesDiv);

        addButtons.appendChild(categoryDropdown);
    });
}

// Create a volume slider for each track.
function createVolumeSlider(trackNumber, updateVolumeCallback) {
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = "1";
    slider.className = "volume-slider";
    slider.addEventListener("input", updateVolumeCallback);
    return slider;
}

// Add a sample to a specified track at the given position.
function addSampleToTrack(categoryName, sampleNumber, trackNumber, position) {

    
    const PIXELS_PER_SECOND = 25;
    const trackDiv = document.getElementById("trackDiv" + trackNumber);
    const sample = categories[categoryName][sampleNumber];

    const convertToPixels = (time) => time * PIXELS_PER_SECOND;

    const checkOverlap = (position, width) => {
        for (let item of tracks[trackNumber]) {
            const itemStart = convertToPixels(item.startTime);
            const itemEnd = itemStart + convertToPixels(item.duration);
            if (position + width > itemStart && position < itemEnd) {
                return itemEnd;
            }
        }
        return -1;
    };

    const createVolumeSlider = (track, audio) => {
        const slider = document.createElement("input");
        Object.assign(slider, {
            type: "range", min: "0", max: "1", step: "0.01", value: "1", className: "sample-volume-slider"
        });
        slider.addEventListener("input", function(event) {
            track[track.length - 1].volume = event.target.value;
            if (isPlaying) {
                activeAudio[trackNumber].volume = volumes[trackNumber] * event.target.value;
            }
        });
        return slider;
    };

    const createDeleteButton = (sample, newItem, trackNumber, sampleIndexInTrack) => {
        const btn = document.createElement("button");
        Object.assign(btn, {
            className: "delete-sample-button", innerText: "✖", title: "Delete Sample"
        });
        btn.addEventListener("click", function() {
            trackDiv.removeChild(newItem);
            tracks[trackNumber].splice(sampleIndexInTrack, 1);
        });
        return btn;
    };

    const audio = new Audio(sample.src);

    audio.addEventListener("loadedmetadata", function() {
        const duration = audio.duration;
        let newPosition = position;
        let overlapPosition = checkOverlap(newPosition, convertToPixels(duration));

        while (overlapPosition !== -1) {
            newPosition = overlapPosition;
            overlapPosition = checkOverlap(newPosition, convertToPixels(duration));
        }

        tracks[trackNumber].push({
            ...sample,
            volume: 1,
            startTime: newPosition / PIXELS_PER_SECOND,
            duration: duration
        });

        const newItem = document.createElement("div");
        Object.assign(newItem.style, {
            left: `${newPosition}px`,
            width: `${convertToPixels(duration)}px`
        });
        newItem.innerText = sample.name;
        newItem.className = "sample-item";
        
        const sampleIndexInTrack = tracks[trackNumber].length - 1;
        
        newItem.appendChild(createVolumeSlider(tracks[trackNumber], audio));
        newItem.appendChild(createDeleteButton(sample, newItem, trackNumber, sampleIndexInTrack));

        trackDiv.appendChild(newItem);


    });
}

// Event listener for the start recording button.
startRecordingButton.addEventListener("click", async () => {
    currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(currentStream);
    
    mmediaRecorder = new MediaRecorder(currentStream);
    
    mmediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mmediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        saveRecordingButton.disabled = false;
    };

    mmediaRecorder.start();
    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;
});
// Event listener for the stop recording button.
stopRecordingButton.addEventListener("click", () => {
    mmediaRecorder.stop();
    startRecordingButton.disabled = false;
    stopRecordingButton.disabled = true;

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null; 
    }
});
// Event listener for saving the recorded audio.
saveRecordingButton.addEventListener("click", () => {
    const name = recordedSampleNameInput.value || "Unnamed Sample";
    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    const audioUrl = URL.createObjectURL(audioBlob);

    const sample = { src: audioUrl, name };

    if (!categories.recorded) {
        categories.recorded = [];
    }

    categories.recorded.push(sample);

    const categoryIndex = 'recorded';
    const sampleIndex = categories.recorded.length - 1;
    const button = document.createElement("button");
    button.setAttribute("data-category-name", categoryIndex);
    button.setAttribute("data-sample-index", sampleIndex);
    button.setAttribute("draggable", "true");
    button.innerText = sample.name;
    button.addEventListener("dragstart", event => {
        event.dataTransfer.setData("categoryName", categoryIndex);
        event.dataTransfer.setData("sampleIndex", sampleIndex);
    });
    addButtons.appendChild(button);

    recordedSampleNameInput.value = "";
    saveRecordingButton.disabled = true;
});

// Check for overlapping samples in a track.
const checkOverlap = (startTime, duration) => {
    for (let item of tracks[trackNumber]) {
        if (item.startTime < startTime + duration && item.startTime + item.duration > startTime) {
            return item.startTime + item.duration;
        }
    }
    return -1;
};

// Create a new track.
function createNewTrack() {
    const trackNumber = tracks.length;
    tracks.push([]);
    volumes.push(1);
    trackLoopingStatus.push(false); 

    const createDivWithClass = (className) => {
        const div = document.createElement("div");
        if (className) div.className = className;
        return div;
    };

    const createButtonWithListener = (innerText, listener) => {
        const button = document.createElement("button");
        button.innerText = innerText;
        button.addEventListener("click", listener);
        return button;
    };

    const trackDiv = createDivWithClass();
    trackDiv.setAttribute("id", "trackDiv" + trackNumber);
    trackDiv.style.position = 'relative';

    trackDiv.addEventListener("dragover", (event) => event.preventDefault());
    trackDiv.addEventListener("drop", (event) => {
        event.preventDefault();
        const categoryName = event.dataTransfer.getData("categoryName");
        const sampleIndex = event.dataTransfer.getData("sampleIndex");
        const dropPosition = event.clientX - trackDiv.getBoundingClientRect().left;
        addSampleToTrack(categoryName, sampleIndex, trackNumber, dropPosition);
    });
    
    
    

    const controlsDiv = createDivWithClass("track-controls");

    const loopCheckbox = document.createElement("input");
    loopCheckbox.type = "checkbox";
    loopCheckbox.id = "loopCheckbox" + trackNumber;
    loopCheckbox.addEventListener("change", (event) => {
        trackLoopingStatus[trackNumber] = event.target.checked;
    });

    const loopLabel = document.createElement("label");
    loopLabel.htmlFor = loopCheckbox.id;
    loopLabel.innerText = "Loop track";

    controlsDiv.append(loopCheckbox, loopLabel, createVolumeSlider(trackNumber, (event) => {
        volumes[trackNumber] = event.target.value;
        if (isPlaying) {
            activeAudio[trackNumber].volume = event.target.value;
        }
    }));

    const deleteTrackButton = createButtonWithListener("X", () => {
        stopAllTracks();

        tracksDiv.removeChild(trackDiv);
        tracksDiv.removeChild(controlsDiv);

        [tracks, volumes, trackLoopingStatus, activeAudio].forEach(arr => arr.splice(trackNumber, 1));
    });
    Object.assign(deleteTrackButton.style, {
        position: "absolute",
        right: "10px"
    });

    trackDiv.appendChild(deleteTrackButton);
    tracksDiv.append(trackDiv, controlsDiv);
}

// Play the entire song comprising of all tracks.
function playSong() {
    if (isPlaying) {
        stopAllTracks();
        return;
    }

    isPlaying = true;
    playButton.innerText = "Stop";
    tracks.forEach((track, index) => track.length && playTrack(track, index));
    elapsedTime = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        elapsedTime++;
        updateTimerDisplay();
    }, 1000);
}
// Calculate the duration of the longest track.
function getLongestTrackDuration() {
    return tracks.reduce((maxDuration, track) => {
        const trackDuration = track.reduce((total, sample) => total + sample.duration, 0) + (track[track.length - 1]?.startTime || 0);
        return Math.max(maxDuration, trackDuration);
    }, 0);
}

// Play a specific track.
function playTrack(trackItems, trackIndex) {
    if (!trackItems || !trackItems.length) return;

    trackItems.forEach(sample => {
        const audio = new Audio(sample.src);
        audio.volume = sample.volume * (volumes[trackIndex] || 1);

        audio.addEventListener("ended", () => {
            if (trackLoopingStatus[trackIndex] && sample === trackItems[trackItems.length - 1]) {
                playTrack(trackItems, trackIndex);
            }
        });

        const timeoutId = setTimeout(() => {
            audio.play();
        }, sample.startTime * 1000); 

        activeAudio.push(audio); 
        timeoutIds.push(timeoutId); 
    });
}

// Stop all tracks during playback.
function stopAllTracks() {
    activeAudio.forEach(audio => {
        audio.pause();
        audio.currentTime = 0; 
    });
    timeoutIds.forEach(id => clearTimeout(id));
    timeoutIds = []; 
    activeAudio = []; 
    isPlaying = false;
    playButton.innerText = "Play";

    clearInterval(timerInterval);
}
// Upload a new sample from user's computer.
function uploadNewSample() {
    const file = fileInput.files[0];
    if (!file) return;

    const audioSrc = URL.createObjectURL(file);

    if (!categories.uploaded) {
        categories.uploaded = [];
    }
    const sample = { src: audioSrc, name: file.name }; 
    categories.uploaded.push(sample);

    const categoryIndex = 'uploaded';
    const sampleIndex = categories.uploaded.length - 1;
    const button = document.createElement("button");
    button.setAttribute("data-category-name", categoryIndex);
    button.setAttribute("data-sample-index", sampleIndex);
    button.setAttribute("draggable", "true");
    button.innerText = sample.name;
    button.addEventListener("dragstart", event => {
        event.dataTransfer.setData("categoryName", categoryIndex);
        event.dataTransfer.setData("sampleIndex", sampleIndex);
    });
    addButtons.appendChild(button);

    fileInput.value = "";
}

const downloadButton = document.getElementById("downloadSong");
// Event listener for downloading the mixed song.
downloadButton.addEventListener("click", async () => {
    const filename = prompt("Please enter a name for the downloaded file:", "mixed_track.wav");
    if (!filename) return;
    const mixDuration = tracks.reduce((maxDuration, track) => {
        const trackDuration = track.reduce((d, sample) => d + sample.duration, 0) + (track[track.length - 1].startTime || 0);
        return Math.max(maxDuration, trackDuration);
    }, 0);

    const offlineContext = new OfflineAudioContext(2, mixDuration * audioContext.sampleRate, audioContext.sampleRate);

    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        let currentStartTime = 0;
        const trackDuration = track.reduce((total, sample) => total + sample.duration, 0) + (track[track.length - 1].startTime || 0);

        do {
            for (let j = 0; j < track.length; j++) {
                const sample = track[j];
                const audioBuffer = await fetchSample(sample.src);
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(currentStartTime + sample.startTime);
            }

            if (trackLoopingStatus[i]) {
                currentStartTime += trackDuration;
            }
        } while (trackLoopingStatus[i] && currentStartTime + trackDuration <= mixDuration);
    }

    offlineContext.startRendering().then(async function(renderedBuffer) {
        const wav = toWAV(renderedBuffer);
        const blob = new Blob([wav], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.wav') ? filename : filename + '.wav';
        a.click();
    });
});


// Fetch a sample from its source.
async function fetchSample(src) {
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

// Convert the given AudioBuffer into WAV format.
function toWAV(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952);                     
    setUint32(length - 8);                       
    setUint32(0x45564157);                   

    setUint32(0x20746d66);                     
    setUint32(16);                               
    setUint16(1);                              
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); 
    setUint16(numOfChan * 2);                     
    setUint16(16);                                 

    setUint32(0x61746164);                       
    setUint32(length - pos - 4);                  

    for (i = 0; i < audioBuffer.numberOfChannels; i++) channels.push(audioBuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {          
            sample = Math.max(-1, Math.min(1, channels[i][offset])); 
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(pos, sample, true);      
            pos += 2;
        }
        offset++                                  
    }

    return buffer;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

// Format time in MM:SS format.
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

// Update the display showing elapsed time during playback.
function updateTimerDisplay() {
    document.getElementById("timerDisplay").innerText = formatTime(elapsedTime);
}


// Event Listeners
addTrackButton.addEventListener("click", createNewTrack);
playButton.addEventListener("click", playSong);
uploadButton.addEventListener("click", uploadNewSample);

// Initialize
initializeSampleButtons();