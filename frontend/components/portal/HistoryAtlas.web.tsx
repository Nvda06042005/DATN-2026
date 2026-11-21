import React from 'react';
import { HistoryAtlasArt, atlasCamera, type AtlasArtProps } from './HistoryAtlasArt';
export const HistoryAtlas: React.FC<AtlasArtProps & { calm?: boolean }> = props => {
  const [x,y,w] = atlasCamera(props.chapter,props.zoom), scale=1400/w;
  return <div style={{position:'relative',width:'100%',height:0,paddingTop:'56.25%',overflow:'hidden',background:'#b8ceb3'}} role="img" aria-label={`Bản đồ địa hình 2D: ${props.chapter.title}. Địa danh có nút khám phá bên dưới bản đồ.`}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1400 787.5" preserveAspectRatio="xMidYMid meet" style={{position:'absolute',top:0,left:0,display:'block'}} onClick={event=>{const marker=(event.target as Element).closest('[id^="atlas-place-"]');if(marker) props.onSelect(marker.id.slice('atlas-place-'.length));}}>
      <g style={{transform:`matrix(${scale},0,0,${scale},${-x*scale},${-y*scale})`,transformOrigin:'0 0',transition:props.calm?'none':'transform 1500ms cubic-bezier(.2,.7,.3,1)'}}><HistoryAtlasArt {...props}/></g>
    </svg>
  </div>;
};
