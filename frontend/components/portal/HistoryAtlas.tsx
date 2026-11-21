import React from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { HistoryAtlasArt, atlasCamera, type AtlasArtProps } from './HistoryAtlasArt';
export const HistoryAtlas: React.FC<AtlasArtProps & { calm?: boolean }> = props => <View style={{width:'100%',aspectRatio:16/9,backgroundColor:'#b8ceb3',overflow:'hidden'}} accessibilityLabel={`Bản đồ 2D: ${props.chapter.title}`}><Svg width="100%" height="100%" viewBox={atlasCamera(props.chapter,props.zoom).join(' ')} preserveAspectRatio="xMidYMid meet"><HistoryAtlasArt {...props} interactive/></Svg></View>;
