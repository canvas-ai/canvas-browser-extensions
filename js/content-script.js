console.log('content-script.js | Initializing CanvasUI content script');

const context = {
    color: "#000"
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('content-script | DOM loaded');
    browser.runtime.sendMessage({ action: 'context:get' })
    .then(response => {        
        console.log('--------------------')
        console.log(response);
    });
});