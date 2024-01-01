console.log('content-script.js | Initializing content script');

let context = {
    color: "#000"
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('content-script | DOM loaded');
    document.body.style.borderRight = "5px solid " + context.color + " !important";    
});