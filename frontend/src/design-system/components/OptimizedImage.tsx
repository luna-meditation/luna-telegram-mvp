import {useState,type ImgHTMLAttributes} from 'react';
import images from '../image-manifest.json';

export type ImageAsset={width:number;height:number;variants:Array<{width:number;src:string;bytes:number}>};
type Asset=ImageAsset;
const assets:Record<string,Asset>=images;
export function imageSource(source:string,width=800){
 const asset=assets[source];
 return asset?.variants.find(v=>v.width>=width)?.src??asset?.variants[asset.variants.length-1]?.src??source;
}
/** Known local assets get responsive derivatives. Remote/private images remain untouched. */
export function OptimizedImage({src='',sizes='(max-width: 600px) calc(100vw - 32px), 480px',loading='lazy',decoding='async',asset:provided,...props}:ImgHTMLAttributes<HTMLImageElement>&{asset?:Asset}){
 const asset=provided??assets[src];
 const [loadedSource,setLoadedSource]=useState<string|null>(null);
 const fallback=asset?.variants.find(v=>v.width>=800)?.src??asset?.variants[asset.variants.length-1]?.src??src;
 return <img {...props} className={`luna-image ${props.className??''}`} data-loaded={loadedSource===src} src={fallback} srcSet={asset?.variants.map(v=>`${v.src} ${v.width}w`).join(', ')} sizes={asset?sizes:undefined} width={props.width??asset?.width} height={props.height??asset?.height} loading={loading} decoding={decoding} onLoad={event=>{setLoadedSource(src);props.onLoad?.(event);}}/>;
}
