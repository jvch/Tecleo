// =======================================================
// DOM Element References
// =======================================================
const typedTextDiv = document.getElementById("typedText");
const givenTextDiv = document.getElementById("givenText");
const progressBar = document.getElementById("progressBar");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const finishSound = new Audio("../success.ogg");

const hiddenTextarea = document.createElement("textarea");
hiddenTextarea.classList.add("hidden-input");
document.body.appendChild(hiddenTextarea);

// =======================================================
// Global State
// =======================================================
let state = {
    files: [],
    currentIndex: 0,
    finishedFiles: [],
    currentGivenText: "",
    startTime: null,
    endTime: null,
    // Total stats for final popup
    totalCharactersTyped: 0,
    totalTimeSeconds: 0,
    typingEnabled: false
};

// =======================================================
// Utility Functions
// =======================================================

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
}

function adjustFontSize() {
    const wrapper = document.querySelector(".text-wrapper");
    let fontSize = 32;
    
    // Helper to apply font size
    const applyFontSize = (size) => {
        typedTextDiv.style.fontSize = size + "px";
        givenTextDiv.style.fontSize = size + "px";
    };

    applyFontSize(fontSize);

    const wrapperWidth = wrapper.clientWidth - 20;

    const tempSpan = document.createElement("span");
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    tempSpan.style.whiteSpace = "pre";
    tempSpan.style.fontFamily = typedTextDiv.style.fontFamily;
    document.body.appendChild(tempSpan);

    let fits = false;

    while (!fits && fontSize > 10) {
        applyFontSize(fontSize);
        tempSpan.style.fontSize = fontSize + "px";

        const heightTooBig = typedTextDiv.scrollHeight > wrapper.clientHeight || givenTextDiv.scrollHeight > wrapper.clientHeight;
        const lines = state.currentGivenText.split("\n");
        let widthTooBig = false;

        for (const line of lines) {
            tempSpan.textContent = line || " ";
            if (tempSpan.offsetWidth > wrapperWidth) {
                widthTooBig = true;
                break;
            }
        }

        if (heightTooBig || widthTooBig) {
            fontSize -= 1;
        } else {
            fits = true;
        }
    }

    document.body.removeChild(tempSpan);
}

// =======================================================
// Core Typing Logic
// =======================================================

function renderOverlay() {
    const typed = hiddenTextarea.value;
    let displayHTML = "";
    let firstWrongFound = false;

    // Start timer on first correct input
    if (state.startTime === null && typed.length > 0 && typed[0] === state.currentGivenText[0]) {
        state.startTime = performance.now();
    }
    
    for (let i = 0; i < typed.length; i++) {
        const char = escapeHTML(typed[i]);
        if (!firstWrongFound && typed[i] !== state.currentGivenText[i]) {
            firstWrongFound = true;
        }

        if (firstWrongFound) {
            displayHTML += `<span class="wrong">${char}</span>`;
        } else {
            displayHTML += char;
        }
    }

    if (state.typingEnabled && typed.length < state.currentGivenText.length) {
        displayHTML += '<span class="caret">&nbsp;</span>';
    }

    typedTextDiv.innerHTML = displayHTML;
    adjustFontSize();
    
    // Check for completion
    if (typed === state.currentGivenText && state.currentGivenText.length > 0 && !state.finishedFiles.includes(state.currentIndex)) {
        handleFileCompletion();
    }
}

function handleFileCompletion() {
    hiddenTextarea.disabled = true;
    state.finishedFiles.push(state.currentIndex);
    
    state.endTime = performance.now();
    
    if (state.startTime !== null) {
        const timeElapsedSeconds = (state.endTime - state.startTime) / 1000;
        const charactersTyped = state.currentGivenText.length;
        const cps = charactersTyped / timeElapsedSeconds;
         
        // Update session totals 
        state.totalCharactersTyped += charactersTyped;
        state.totalTimeSeconds += timeElapsedSeconds;
        
        showFileCompletionPopup(cps.toFixed(2));
    }
    
    updateButtonStates();
    updateProgressBar();
    finishSound.play();
}

// =======================================================
// Navigation and State Management
// =======================================================

function loadFile(index) {
    if (index < 0 || index >= state.files.length) return;

    state.currentIndex = index;
    state.startTime = null;
    state.endTime = null;
    
    fetch("archivos/" + state.files[index])
        .then(r => r.text())
        .then(text => {
            state.currentGivenText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            givenTextDiv.textContent = state.currentGivenText;

            const isFinished = state.finishedFiles.includes(state.currentIndex);
            hiddenTextarea.value = isFinished ? state.currentGivenText : "";
            hiddenTextarea.disabled = isFinished;
            state.typingEnabled = isFinished;
            
            adjustFontSize();
            renderOverlay();
            updateButtonStates();
            updateProgressBar();
        });
}

function nextFile() {
    if (state.currentIndex < state.files.length - 1 && state.finishedFiles.includes(state.currentIndex)) {
        loadFile(state.currentIndex + 1);
    }
}

function prevFile() {
    if (state.currentIndex > 0) {
        loadFile(state.currentIndex - 1);
    }
}

function updateButtonStates() {
    prevBtn.style.cursor = state.currentIndex <= 0 ? "not-allowed" : "pointer";
    prevBtn.style.opacity = state.currentIndex <= 0 ? 0.5 : 1;

    // Next is only enabled if there's a next file AND the current one is finished
    const canGoNext = state.currentIndex < state.files.length - 1 && state.finishedFiles.includes(state.currentIndex);
    
    nextBtn.style.cursor = canGoNext ? "pointer" : "not-allowed";
    nextBtn.style.opacity = canGoNext ? 1 : 0.5;
}

function updateProgressBar() {
    const progress = (state.finishedFiles.length / state.files.length) * 100;
    progressBar.style.width = progress + "%";
}

// =======================================================
// Popup / Modal Functions
// =======================================================

function showFileCompletionPopup(cps) {
    const isLastFile = state.currentIndex === state.files.length - 1;
        
    const popup = document.createElement("div");
    popup.id = "fileCompletionPopup"; 
    // MODIFICADO: Solo muestra "Velocidad de tipeo:" en un renglón 
    // y el valor CPS en otro, utilizando <h1> para que sea más grande.
    popup.innerHTML = `
        <div class="popup-content">
            <p>Velocidad:</p>
            <h1>${cps} caracteres por segundo</h1>
            <button id="closeFilePopup">Continuar</button>
        </div>
    `;
    document.body.appendChild(popup);

    document.getElementById("closeFilePopup").addEventListener("click", () => {
        document.body.removeChild(popup);
        
        if (isLastFile) {
            showCompletionPopup();
        } else {
            nextFile();
        }
    });
}

function showCompletionPopup() {
    let averageCPS = 0;
    if (state.totalTimeSeconds > 0) {
        averageCPS = (state.totalCharactersTyped / state.totalTimeSeconds).toFixed(2);
    }
    
    const popup = document.createElement("div");
    popup.id = "completionPopup"; 
    popup.innerHTML = `
        <div class="popup-content">
            <h2>🏆¡Terminaste todos los programas!🏆</h2>
            <h1>Tu velocidad promedio fue de **${averageCPS} caracteres por segundo**.</h1>
            <p>➡ Regresa a Classroom para la siguiente actividad</p>
            <button id="closePopup">Cerrar</button>
        </div>
    `;
    document.body.appendChild(popup);

    document.getElementById("closePopup").addEventListener("click", () => {
        document.body.removeChild(popup);
    });
}

// =======================================================
// Event Listeners
// =======================================================

// 1. Input Restriction Handler (Keydown)
hiddenTextarea.addEventListener("keydown", (e) => {
    const typed = hiddenTextarea.value;

    if (["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) return;

    // Prevent typing after the first mistake
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== state.currentGivenText[i]) {
            e.preventDefault();
            return;
        }
    }

    // Enter Key Logic (Prevent adding new lines if not expected)
    if (e.key === "Enter") {
        const lastIndex = typed.lastIndexOf("\n");
        const currentLineStart = lastIndex + 1;
        const currentLine = typed.slice(currentLineStart);
        const correspondingText = state.currentGivenText.slice(currentLineStart, currentLineStart + currentLine.length);
        if (currentLine !== correspondingText) e.preventDefault();
    }
    
    // Tab Key Logic (Fixed logic)
    if (e.key === "Tab") {
        e.preventDefault();
        
        const start = hiddenTextarea.selectionStart;
        const end = hiddenTextarea.selectionEnd;
        
        const expectedChar = state.currentGivenText[start];
        let insertContent = "    "; // Default to 4 standard spaces
        
        // Determine the correct content to insert (Tab or 4 Spaces)
        if (expectedChar === '\t') {
            insertContent = '\t'; 
        } else if (state.currentGivenText.substring(start, start + 4) === "    ") {
            insertContent = "    "; 
        } else {
            // If the next expected character isn't a tab or 4 spaces, stop
            if (expectedChar !== '\t' && state.currentGivenText.substring(start, start + 4) !== "    ") return; 
        }

        hiddenTextarea.value =
            hiddenTextarea.value.substring(0, start) +
            insertContent +
            hiddenTextarea.value.substring(end);
            
        hiddenTextarea.selectionStart = hiddenTextarea.selectionEnd = start + insertContent.length;
        renderOverlay();
    }
});

// 2. Input/Typing Handler
hiddenTextarea.addEventListener("input", renderOverlay);

// 3. Prevent Pasting Text
hiddenTextarea.addEventListener("paste", (e) => {
    e.preventDefault();
});

// 4. Enable typing on click
document.querySelector(".text-wrapper").addEventListener("click", () => {
    if (!state.finishedFiles.includes(state.currentIndex)) {
        state.typingEnabled = true;
        hiddenTextarea.focus();
        renderOverlay();
    }
});

// 5. Navigation Buttons
nextBtn.addEventListener("click", nextFile);
prevBtn.addEventListener("click", prevFile);

// 6. Arrow Keys Navigation
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") nextFile();
    if (e.key === "ArrowLeft") prevFile();
});

// =======================================================
// Initialization
// =======================================================

function initialize() {
    fetch("index.json")
        .then(r => r.json())
        .then(data => {
            state.files = data.files;
            loadFile(state.currentIndex);
        })
        .catch(error => console.error("Error loading index.json:", error));
}

initialize();
