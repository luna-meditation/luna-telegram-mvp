import type {ImgHTMLAttributes} from 'react';
import {OptimizedImage,type ImageAsset} from '../../design-system/components/OptimizedImage';
import images from './image-manifest.json';
const assets:Record<string,ImageAsset>=images;
export function TarotImage(props:ImgHTMLAttributes<HTMLImageElement>){return <OptimizedImage {...props} asset={props.src?assets[props.src]:undefined}/>;}
