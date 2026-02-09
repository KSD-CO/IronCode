// Type declarations for asset imports used across packages
declare module "*.aac" {
  const src: string
  export default src
}

declare module "*.mp3" {
  const src: string
  export default src
}

declare module "*.wav" {
  const src: string
  export default src
}

declare module "*.svg" {
  const src: string
  export default src
}

declare module "*.png" {
  const src: string
  export default src
}

declare module "*.jpg" {
  const src: string
  export default src
}

declare module "*.jpeg" {
  const src: string
  export default src
}

declare module "*.gif" {
  const src: string
  export default src
}

declare module "*.webp" {
  const src: string
  export default src
}

declare module "*.woff" {
  const src: string
  export default src
}

declare module "*.woff2" {
  const src: string
  export default src
}

declare module "*.ttf" {
  const src: string
  export default src
}

declare module "*.eot" {
  const src: string
  export default src
}

declare module "*?worker&url" {
  const WorkerUrl: string
  export default WorkerUrl
}

declare module "*?worker" {
  const WorkerConstructor: new () => Worker
  export default WorkerConstructor
}
