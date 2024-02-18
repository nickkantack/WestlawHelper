// ==UserScript==
// @name         WestlawHelper
// @namespace    http://tampermonkey.net/
// @version      2024-02-18
// @description  Improvements to Westlaw
// @author       Nick Kantack
// @match        https://1.next.westlaw.com/*
// @match        https://*/*
// @match        http://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=westlaw.com
// @grant        GM_addStyle
// ==/UserScript==

const DOWNLOAD_BUTTON_ID = `coid_deliveryWaitMessage_downloadButton`;
const DOWNLOAD_MINIMIZE_BUTTON_ID = `coid_deliveryWaitMessage_minimizeButton`;
const HEADER_MESSAGE_DIV_ID = `co_headerMessage`;
let lastCountForDownloadsInHistoryTableWhenClicked = 0;
let isDownloadTableOpenBecauseOfMe = false;

async function clickAvailableDownloadButtons() {
    console.log(`Running loop`);
    if (document.getElementById(DOWNLOAD_BUTTON_ID) &&
        document.getElementById(HEADER_MESSAGE_DIV_ID) &&
        /ready\sfor\sdownload/i.test(document.getElementById(HEADER_MESSAGE_DIV_ID).innerHTML)) {
        // console.log(`Would click download button from dialog`);
        document.getElementById(HEADER_MESSAGE_DIV_ID).click();
        try {
            document.getElementById(DOWNLOAD_MINIMIZE_BUTTON_ID).click();
        } catch (e) {
            console.warn(`Unable to find the minimize button to try to close the download dialog`);
        }
        // Give the window some time to close so that we don't download again
        await new Promise((resolve, reject) => setTimeout(resolve, 2000));
    }

    // Check if there are downloads in the download history table
    const isDownloadHistoryClosed = [...document.querySelectorAll("span.co_tbButton")].length === 0;
    const counterForDownloadsInHistoryTable = document.getElementById(`dq_status_message`);
    const countForDownloadsInHistoryTable = counterForDownloadsInHistoryTable ? parseInt(counterForDownloadsInHistoryTable.innerHTML) : 0;
    const areThereDownloadsInTheHistoryTable = counterForDownloadsInHistoryTable && parseInt(counterForDownloadsInHistoryTable.innerHTML) > 0;
    // console.log(`The count for the downloads table is ${countForDownloadsInHistoryTable}`);
    if (isDownloadHistoryClosed && areThereDownloadsInTheHistoryTable && lastCountForDownloadsInHistoryTableWhenClicked < countForDownloadsInHistoryTable) {
        // console.log(`Clicking open the download table`);
        counterForDownloadsInHistoryTable.click();
        lastCountForDownloadsInHistoryTableWhenClicked = countForDownloadsInHistoryTable;
        // console.log(`Now the count outside the loop is ${lastCountForDownloadsInHistoryTableWhenClicked}`);
        isDownloadTableOpenBecauseOfMe = true;
        // Wait a little bit for the download buttons to be created
        await new Promise((resolve, reject) => {
            setTimeout(resolve, 1000);
        });
    }

    const tableDownloadButtons = [...(document.querySelectorAll(`span.co_tbButton`) || [])].filter(x => />Download$/.test(x.innerHTML));
    if (tableDownloadButtons.length > 0) {
        // console.log(`Would click download button from table`);
        tableDownloadButtons.forEach(x => x.click());
    }
    if (isDownloadTableOpenBecauseOfMe) {
        counterForDownloadsInHistoryTable.click();
        isDownloadTableOpenBecauseOfMe = false;
    }
}

let recentTildeCount = 0;
let tildeClearTimeout;
let checkClearTimeout;
let areControlsShowing = false;

function createControlPanel() {

    const controlPanelStyles = `
        .controlPanel .closeButton {
            position: absolute;
            right: 0;
            top: 0;
            transform: translate(50%, -50%);
            padding: 0;
            width: 30px;
            height: 30px;
            border-radius: 30px;
            background: #004970;
        }
        .controlPanel .indicatorSvg {
            width: 1em;
            height: 1em;
            margin: 0.5em;
            transform: translate(0, 50%);
        }
        .controlPanel .indicatorSvg g {
            transition: transform 0.5s ease;
        }
        .controlPanel {
            font-family: Tahoma;
            position: fixed;
            top: 0;
            right: 0;
            margin: 2em;
            padding: 1em;
            background: #004970;
            border-radius: 10px;
            border: 3px solid #0b6b9e;
            z-index: 9999999;
            transition: 0.25s;
            color: #FFF;
        }
        .controlPanel button {
            font-family: Tahoma;
            padding: 0.5em;
            border-radius: 10px;
            border: 3px solid #0b6b9e;
            background: #004970;
            color: #FFF;
            transition: 0.25s;
        }
        .controlPanel button:hover {
            background: #127cb5;
        }
        .outOfViewToRight {
            left: 110%;
        }
        #playbackSpeedInput {
            border-radius: 10px;
            border: 2px solid #0b6b9e;
            background: #004970;
            color: #fff;
            padding: 0.5em;
            width: 6em;
            margin-right: 1em;
            margin-top: 0.5em;
        }
    `;

    const controlPanelDiv = document.createElement(`div`);
    controlPanelDiv.classList.add("controlPanel");
    GM_addStyle(controlPanelStyles);
    controlPanelDiv.innerHTML += `Enter video speed<br/>`;
    const playbackSpeedInput = document.createElement("input");
    playbackSpeedInput.setAttribute(`placeholder`, `playback speed`);
    playbackSpeedInput.value = 1;
    playbackSpeedInput.id = `playbackSpeedInput`;
    controlPanelDiv.appendChild(playbackSpeedInput);
    const applyVideoSpeedButton = document.createElement(`button`);
    applyVideoSpeedButton.id = `applyVideoSpeedButton`;
    applyVideoSpeedButton.innerHTML = `Apply`;
    controlPanelDiv.appendChild(applyVideoSpeedButton);

    const speedAppliedSvg = document.createElementNS(`http://www.w3.org/2000/svg`, `svg`);
    speedAppliedSvg.classList.add(`indicatorSvg`);
    speedAppliedSvg.setAttribute(`viewBox`, `-10 -10 120 120`);
    controlPanelDiv.appendChild(speedAppliedSvg);
    const checkGroup = document.createElementNS(`http://www.w3.org/2000/svg`, `g`);
    checkGroup.innerHTML = `<circle cx="50" cy="50" r="50" fill="#090" stroke="#060" stroke-width="14"/>
        <path fill="none" stroke="#FFF" stroke-width="10" d="M25 50L45 70L75 30" />`;
    checkGroup.setAttribute(`transform`, `translate(0, 120)`);
    speedAppliedSvg.appendChild(checkGroup);

    applyVideoSpeedButton.addEventListener("click", () => {
        const speed = playbackSpeedInput.value;
        if (!speed || isNaN(speed) || speed <= 0) {
            alert(`${playbackSpeedInput.value} is not a valid playback speed. Must be a number greater than zero.`);
            playbackSpeedInput.value = 1;
            return;
        }
        [...document.querySelectorAll("video")].forEach(x => {
            x.defaultPlaybackRate = speed;
            x.playbackRate = speed;
        });
        console.log(`Edited video speed`);
        checkGroup.setAttribute(`transform`, `translate(0, 0)`);
        clearTimeout(checkClearTimeout);
        checkClearTimeout = setTimeout(() => {
            checkGroup.setAttribute(`transform`, `translate(0, 120)`);
        }, 1000);
    });

    document.body.appendChild(controlPanelDiv);

    // Create close button
    const closeButton = document.createElement("button");
    closeButton.innerHTML = `<svg viewBox="0 0 100 100"><g stroke="#FFF" stroke-width="13"><path d="M30 70L70 30"/><path d="M30 30L70 70" /></g></svg>`;
    closeButton.classList.add(`closeButton`);
    closeButton.addEventListener("click", () => {
        controlPanelDiv.style.transform = `translate(200%, 0)`;
        areControlsShowing = false;
    });
    controlPanelDiv.appendChild(closeButton);

    // Set open and close controls via tilde key
    controlPanelDiv.style.transform = `translate(200%, 0)`;
    document.body.addEventListener("keydown", (e) => {
        if (e.keyCode === 192) {
            recentTildeCount++;
            clearTimeout(tildeClearTimeout);
            tildeClearTimeout = setTimeout(() => {
                recentTildeCount = 0;
            }, 300);
            if (recentTildeCount < 3) {
                clearTimeout(tildeClearTimeout);
                return;
            }
            // If we make it here, there have been sufficiently many tilde taps in a row
            recentTildeCount = 0;
            if (areControlsShowing) {
                areControlsShowing = false;
                controlPanelDiv.style.transform = `translate(200%, 0)`;
            } else {
                areControlsShowing = true;
                controlPanelDiv.style.transform = `translate(0, 0)`;
            }
        }
    });

}


(function() {
    'use strict';

    createControlPanel();

    if (/westlaw/.test(window.location)) setInterval(clickAvailableDownloadButtons, 1000);
})();