declare module '*.css';

declare module '*.module.scss' {
  const styles: { [className: string]: string };
  export default styles;
}