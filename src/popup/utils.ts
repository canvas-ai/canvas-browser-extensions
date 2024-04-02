import { Dispatch } from "redux";
import { setBrowserTabs, setCanvasTabs } from "./redux/tabs/tabActions";

export const fetchVariable = (message: { action: string }) => {
  return chrome.runtime.sendMessage(message);
}

export const sanitizeContextUrl = (url: string) => {
  console.log('UI | Sanitizing context URL')
  console.log(url)
  if (!url || url == '/' || url == 'universe:///') return 'Universe'
  url = url
      .replace(/^universe/, 'Universe')
      .replace(/\/\//g, '/')
      .replace(/\:/g, '')
      //.replace(/universe/g,'∞')
  return url
}

export const getContextBreadcrumbs = (url: string) => {
  console.log('UI | Updating breadcrumbs')
  if (!url) return []; // console.error('UI | No URL provided')
  if (typeof url !== 'string') return []; // console.error('UI | URL is not a string')

  url = sanitizeContextUrl(url)
  const breadcrumbNames = url.split("/").filter((name) => name !== "");
  return breadcrumbNames.map((name) => {
    return {
      href: "#!",
      className: "breadcrumb black-text",
      textContent: name
    }
  });
}

export const updateTabs = (dispatch: Dispatch<any>) => {
  Promise.all([
    fetchVariable({ action: 'index:get:deltaBrowserToCanvas' }),
    fetchVariable({ action: 'index:get:deltaCanvasToBrowser' })
  ]).then((values) => {
    // Update tab lists
    dispatch(setBrowserTabs(values[0]));
    dispatch(setCanvasTabs(values[1]));
    // setBrowserToCanvasTabsDelta(values[0]);
    // setCanvasToBrowserTabsDelta(values[1]);
    console.log('UI | UI updated');
  }).catch(error => {
    console.error('UI | Error updating UI:', error);
  });;
}