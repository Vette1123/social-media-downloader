import OpenGraphImage, {
  contentType as ogContentType,
  generateStaticParams as ogStaticParams,
  size as ogSize,
} from './opengraph-image'

export const dynamic = 'force-static'
export const size = ogSize
export const contentType = ogContentType
export const generateStaticParams = ogStaticParams

export default OpenGraphImage
