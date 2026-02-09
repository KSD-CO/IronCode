/**
 * Type declarations for asset imports
 */

// Audio files
declare module "*.aac" {
  const content: string
  export default content
}

declare module "*.mp3" {
  const content: string
  export default content
}

declare module "*.wav" {
  const content: string
  export default content
}

// Image files
declare module "*.svg" {
  const content: string
  export default content
}

declare module "*.png" {
  const content: string
  export default content
}

declare module "*.jpg" {
  const content: string
  export default content
}

declare module "*.jpeg" {
  const content: string
  export default content
}

declare module "*.gif" {
  const content: string
  export default content
}

declare module "*.webp" {
  const content: string
  export default content
}

// Font files
declare module "*.woff" {
  const content: string
  export default content
}

declare module "*.woff2" {
  const content: string
  export default content
}

declare module "*.ttf" {
  const content: string
  export default content
}

declare module "*.eot" {
  const content: string
  export default content
}

// Worker files
declare module "*?worker&url" {
  const content: string
  export default content
}

declare module "*?worker" {
  const WorkerConstructor: new () => Worker
  export default WorkerConstructor
}

export {}
