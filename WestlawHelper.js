// ==UserScript==
// @name         WestlawHelper
// @namespace    http://tampermonkey.net/
// @version      2024-02-03
// @description  Improvements to Westlaw
// @author       Nick Kantack
// @match        https://1.next.westlaw.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=westlaw.com
// @grant        none
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

(function() {
    'use strict';

    setInterval(clickAvailableDownloadButtons, 1000);
})();