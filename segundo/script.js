const typedDiv = document.getElementById("typedText");
const givenDiv = document.getElementById("givenText");

const hiddenTextarea = document.createElement("textarea");
hiddenTextarea.classList.add("hidden-input");
document.body.appendChild(hiddenTextarea);

let givenText = "";
let files = [];
let currentIndex = 0;
let finishedFiles = [];
let typingEnabled = false;

// Load finish sound
const finishSound = new Audio("../success.ogg");

// Escape HTML
function escapeHTML(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// Load JSON
fetch("index.json")
    .then(r => r.json())
    .then(data => {
        files = data.files;
        loadFile(currentIndex);
    });

// Load file
function loadFile(index) {
    if (index < 0 || index >= files.length) return;
    fetch("archivos/" + files[index])
        .then(r => r.text())
        .then(text => {
            givenText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            givenDiv.textContent = givenText;

            hiddenTextarea.value = finishedFiles.includes(currentIndex) ? givenText : "";
            hiddenTextarea.disabled = finishedFiles.includes(currentIndex);
            typingEnabled = finishedFiles.includes(currentIndex);
            adjustFontSize();
            updateOverlay();
            updateButtonStates();
            updateProgressBar();
        });
}

// Adjust font size
function adjustFontSize() {
    const wrapper = document.querySelector(".text-wrapper");
    let fontSize = 32;
    typedDiv.style.fontSize = fontSize + "px";
    givenDiv.style.fontSize = fontSize + "px";

    const wrapperWidth = wrapper.clientWidth - 20;

    const tempSpan = document.createElement("span");
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    tempSpan.style.whiteSpace = "pre";
    tempSpan.style.fontFamily = typedDiv.style.fontFamily;
    document.body.appendChild(tempSpan);

    let fits = false;

    while (!fits && fontSize > 10) {
        typedDiv.style.fontSize = fontSize + "px";
        givenDiv.style.fontSize = fontSize + "px";
        tempSpan.style.fontSize = fontSize + "px";

        let heightTooBig = typedDiv.scrollHeight > wrapper.clientHeight || givenDiv.scrollHeight > wrapper.clientHeight;
        const lines = givenText.split("\n");
        let widthTooBig = false;

        for (const line of lines) {
            tempSpan.textContent = line || " ";
            if (tempSpan.offsetWidth > wrapperWidth) {
                widthTooBig = true;
                break;
            }
        }

        if (heightTooBig || widthTooBig) fontSize -= 1;
        else fits = true;
    }

    document.body.removeChild(tempSpan);
}

// Update overlay
function updateOverlay() {
    const typed = hiddenTextarea.value;
    let displayHTML = "";
    let firstWrongFound = false;

    for (let i = 0; i < typed.length; i++) {
        const char = escapeHTML(typed[i]);
        if (!firstWrongFound && typed[i] !== givenText[i]) firstWrongFound = true;

        if (firstWrongFound) displayHTML += `<span class="wrong">${char}</span>`;
        else displayHTML += char;
    }

    if (typingEnabled && typed.length < givenText.length) displayHTML += '<span class="caret">&nbsp;</span>';

    typedDiv.innerHTML = displayHTML;
    adjustFontSize();

    // Mark file finished
    if (typed === givenText && givenText.length > 0 && !finishedFiles.includes(currentIndex)) {
        hiddenTextarea.disabled = true;
        finishedFiles.push(currentIndex);
        updateButtonStates();
        updateProgressBar();
        finishSound.play();
        if (finishedFiles.length === files.length) {
            //finishSound.play();
            showCompletionPopup();
        }
    }
}

// Prevent typing after wrong character & Enter rules
hiddenTextarea.addEventListener("keydown", (e) => {
    const typed = hiddenTextarea.value;

    if (["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab"].includes(e.key)) return;

    for (let i = 0; i < typed.length; i++) {
        if (typed[i] !== givenText[i]) {
            e.preventDefault();
            return;
        }
    }

    if (e.key === "Enter") {
        const lastIndex = typed.lastIndexOf("\n");
        const currentLineStart = lastIndex + 1;
        const currentLine = typed.slice(currentLineStart);
        const correspondingText = givenText.slice(currentLineStart, currentLineStart + currentLine.length);
        if (currentLine !== correspondingText) e.preventDefault();
    }
});

// Input handler
hiddenTextarea.addEventListener("input", updateOverlay);

// Enable typing on click
document.querySelector(".text-wrapper").addEventListener("click", () => {
    if (!finishedFiles.includes(currentIndex)) {
        typingEnabled = true;
        hiddenTextarea.focus();
        updateOverlay();
    }
});

// Tab support
hiddenTextarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
        e.preventDefault();
        const start = hiddenTextarea.selectionStart;
        const end = hiddenTextarea.selectionEnd;
        const spaces = "    ";
        hiddenTextarea.value =
            hiddenTextarea.value.substring(0, start) +
            spaces +
            hiddenTextarea.value.substring(end);
        hiddenTextarea.selectionStart = hiddenTextarea.selectionEnd = start + spaces.length;
        updateOverlay();
    }
});

// Arrow keys navigation
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") nextFile();
    if (e.key === "ArrowLeft") prevFile();
});

// Buttons
document.getElementById("nextBtn").addEventListener("click", nextFile);
document.getElementById("prevBtn").addEventListener("click", prevFile);

// Next/Prev functions
function nextFile() {
    if (currentIndex < files.length - 1 && finishedFiles.includes(currentIndex)) {
        currentIndex++;
        loadFile(currentIndex);
    }
}
function prevFile() {
    if (currentIndex > 0) {
        currentIndex--;
        loadFile(currentIndex);
    }
}

// Update button styles
function updateButtonStates() {
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    prevBtn.style.cursor = currentIndex <= 0 ? "not-allowed" : "pointer";
    prevBtn.style.opacity = currentIndex <= 0 ? 0.5 : 1;

    if (currentIndex >= files.length - 1 || !finishedFiles.includes(currentIndex)) {
        nextBtn.style.cursor = "not-allowed";
        nextBtn.style.opacity = 0.5;
    } else {
        nextBtn.style.cursor = "pointer";
        nextBtn.style.opacity = 1;
    }
}

// Update progress bar
function updateProgressBar() {
    const progress = (finishedFiles.length / files.length) * 100;
    document.getElementById("progressBar").style.width = progress + "%";
}

/* ========== Custom Completion Popup ========== */
function showCompletionPopup() {
    const popup = document.createElement("div");
    popup.id = "completionPopup";
    popup.innerHTML = `
        <div class="popup-content">
            <h2>🏆¡Terminaste todos los programas!🏆</h2>
            <p>➡ Regresa a Classroom para la siguiente actividad</p>
            <button id="closePopup">Cerrar</button>
        </div>
    `;
    document.body.appendChild(popup);

    document.getElementById("closePopup").addEventListener("click", () => {
        document.body.removeChild(popup);
    });
}
