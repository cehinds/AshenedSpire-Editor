import {clone,uid,effectivePose} from './core.mjs';

export function makeFrameIndependent(project,animationId,index) {
  const frame=project.animations[animationId]?.frames[index];
  if(!frame)throw Error('Select a timeline frame first.');
  const pose=effectivePose(project,frame),id=uid('pose');
  pose.id=id;pose.name+=' · frame copy';pose.reviewed=false;
  project.poses[id]=pose;frame.poseId=id;frame.overrides={};
  return id;
}

export function addFrame(project,animationId,index,pose) {
  const frames=project.animations[animationId].frames,id=uid('pose'),copy=clone(pose);
  copy.id=id;copy.name+=' · new frame';copy.reviewed=false;project.poses[id]=copy;
  const next=Math.min(Math.max(0,index+1),frames.length);
  frames.splice(next,0,{id:uid('frame'),poseId:id,duration:frames[index]?.duration||150,event:'',overrides:{}});
  return {index:next,poseId:id};
}

export function removeFrame(project,animationId,index) {
  const frames=project.animations[animationId].frames;
  if(!frames[index])throw Error('There is no selected frame to delete.');
  frames.splice(index,1);
  const next=Math.max(0,Math.min(index,frames.length-1));
  return {index:next,poseId:frames[next]?.poseId||null};
}
