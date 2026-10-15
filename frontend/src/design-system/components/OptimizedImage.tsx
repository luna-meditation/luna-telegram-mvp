import type {ImgHTMLAttributes} from 'react';
import images from '../image-manifest.json';

type Asset={width:number;height:number;variants:Array<{width:number;src:string;bytes:number}>};
const assets:Record<string,Asset>=images;
export function imageSource(source:string,width=800){
 const asset=assets[source];
 return asset?.variants.find(v=>v.width>=width)?.src??asset?.variants.at(-1)?.src??source;
}
/** Known local assets get responsive derivatives. Remote/private images remain untouched. */
export function OptimizedImage({src='',sizes='(max-width: 600px) calc(100vw - 32px), 480px',loading='lazy',decoding='async',...props}:ImgHTMLAttributes<HTMLImageElement>){
 const asset=assets[src];
 return <img {...props} src={imageSource(src)} srcSet={asset?.variants.map(v=>`${v.src} ${v.width}w`).join(', ')} sizes={asset?sizes:undefined} width={props.width??asset?.width} height={props.height??asset?.height} loading={loading} decoding={decoding}/>;
}
