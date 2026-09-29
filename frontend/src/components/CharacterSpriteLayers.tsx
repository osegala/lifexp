import { useId } from "react";
import Svg, { ClipPath, Defs, FeColorMatrix, Filter, G, Image, Path, Rect, Use } from "react-native-svg";

import type { ResolvedCharacterSprite } from "../avatar/assetRegistry";
import { sourceFrameTransform, spriteImageRect, spriteTransform, trouserTuckPath, trouserTuckSlices } from "../avatar/spriteLayout";
import { avatarTintMatrix } from "../avatar/colorize";

/** One shared coordinate space keeps clipping identical at every avatar size. */
export default function CharacterSpriteLayers({ sprites, tintColors }: {
  sprites: readonly ResolvedCharacterSprite[];
  tintColors: Readonly<Record<"skin" | "hair" | "eyes", string>>;
}) {
  const id = useId().replace(/:/g, "");
  const tuckId = `${id}-tuck`;
  const hairClip = sprites.find(sprite => sprite.hairClip)?.hairClip;
  const headClip = sprites.find(sprite => sprite.headClip)?.headClip;
  const tuckPonytail = sprites.some(sprite => sprite.tuckPonytail);
  const fullOutfit = sprites.some(sprite => sprite.fullOutfit);
  const coversShoulderCaps = sprites.some(sprite => sprite.coversShoulderCaps);
  const cuffs = sprites.flatMap(sprite => sprite.bootCuff ? [sprite.bootCuff] : []);
  const tuckPath = trouserTuckPath(cuffs);
  const coveredLegs = !fullOutfit && cuffs.length > 0 && sprites.some(sprite => sprite.layer === "bottoms");
  const plans = sprites.map(sprite => !fullOutfit && sprite.trouserLegs && trouserTuckSlices(cuffs, sprite.trouserLegs));

  return (
    <Svg width="100%" height="100%" viewBox="0 -64 1254 1318">
      <Defs>
        {Object.entries(tintColors).map(([channel, color]) => (
          <Filter key={channel} id={`${id}-tint-${channel}`} x="-10%" y="-10%" width="120%" height="120%">
            <FeColorMatrix
              type="matrix"
              values={avatarTintMatrix(channel as "skin" | "hair" | "eyes", color)}
            />
          </Filter>
        ))}
        {hairClip && <ClipPath id={`${id}-hair`}><Path d={hairClip} /></ClipPath>}
        {headClip && <ClipPath id={`${id}-head`}><Path d={headClip} /></ClipPath>}
        {tuckPath && <ClipPath id={tuckId}><Path d={tuckPath} /></ClipPath>}
        <ClipPath id={`${id}-right-leg`}><Rect x={0} y={0} width={627} height={1254} /></ClipPath>
        <ClipPath id={`${id}-left-leg`}><Rect x={627} y={0} width={627} height={1254} /></ClipPath>
        {/* Keep skin inside the neckline, without the starter shirt or hip edges. */}
        <ClipPath id={`${id}-dress-underlay`}><Rect x={584} y={0} width={86} height={390} /></ClipPath>
        <ClipPath id={`${id}-dress-legs`}><Rect x={0} y={900} width={1254} height={354} /></ClipPath>
        {/* Opt-in fitted tops retain the open neckline but hide skin above their shoulder seam. */}
        <ClipPath id={`${id}-covered-shoulders`}><Path d="M548 0H706V318H1254V1254H0V318H548Z" /></ClipPath>
        {sprites.map(({ frame, source, clipPath, tint }, index) => (
          <G key={index}>
            {frame && <ClipPath id={`${id}-frame-${index}`}><Rect {...frame.destination} /></ClipPath>}
            {frame?.sourceClipPath && <ClipPath id={`${id}-source-${index}`}>
              <Path d={frame.sourceClipPath} transform={sourceFrameTransform(frame)} clipRule="evenodd" fillRule="evenodd" />
            </ClipPath>}
            {clipPath && <ClipPath id={`${id}-shape-${index}`}><Path d={clipPath} clipRule="evenodd" fillRule="evenodd" /></ClipPath>}
            <G
              id={`${id}-image-${index}`}
              clipPath={frame ? `url(#${id}-frame-${index})` : undefined}
              filter={tint ? `url(#${id}-tint-${tint})` : undefined}
            >
              <G clipPath={clipPath ? `url(#${id}-shape-${index})` : undefined}>
                <G clipPath={frame?.sourceClipPath ? `url(#${id}-source-${index})` : undefined}>
                  <Image href={source} {...spriteImageRect(frame)} preserveAspectRatio="none" />
                </G>
              </G>
            </G>
          </G>
        ))}
        {plans.map((plan, index) => plan && (
          <G key={index}>
            <ClipPath id={`${id}-top-${index}`}><Rect x={0} y={0} width={1254} height={plan.startY + 0.25} /></ClipPath>
            {plan.slices.map((slice, band) => (
              <ClipPath key={band} id={`${id}-band-${index}-${band}`}><Rect {...slice.clip} /></ClipPath>
            ))}
          </G>
        ))}
      </Defs>
      {sprites.map(({ key, frame, layer, region, hairPart }, index) => {
        const isLeg = region && /Leg|foot/.test(region);
        // Pants plus boots cover the entire leg. Omitting that body layer also
        // prevents skin wedges where the fabric has a narrower silhouette.
        if (isLeg && coveredLegs) return null;
        if (fullOutfit && layer === "bottoms") return null;
        const tuck = tuckPath && (layer === "bottoms" || isLeg);
        const plan = plans[index];
        const href = `#${id}-image-${index}`;
        const lowerPonytail = tuckPonytail && hairPart === "ponytail";
        const coveredShoulder = coversShoulderCaps
          && (region === "torso" || region === "upperArmLeft" || region === "upperArmRight");
        const clipId = tuck ? tuckId
          : headClip && region === "head" ? `${id}-head`
          : hairClip && !lowerPonytail && (layer === "hairFront" || layer === "hairBack" || layer === "hairDrape") ? `${id}-hair`
          : undefined;
        const bodyClip = fullOutfit && (region === "torso" || region === "neck") ? `${id}-dress-underlay`
          : fullOutfit && isLeg ? `${id}-dress-legs`
            : coveredShoulder ? `${id}-covered-shoulders` : undefined;
        return (
          <G key={key} clipPath={bodyClip ? `url(#${bodyClip})` : undefined}>
          <G clipPath={clipId ? `url(#${clipId})` : undefined}>
            {plan ? <>
              <Use href={href} clipPath={`url(#${id}-top-${index})`} />
              {plan.slices.map((slice, band) => (
                <G key={band} clipPath={`url(#${id}-band-${index}-${band})`}>
                  <G transform={`matrix(${slice.scaleX} 0 0 1 ${slice.translateX} 0)`}>
                    <Use href={href} clipPath={`url(#${id}-${slice.sourceHalf.x === 0 ? "right" : "left"}-leg)`} />
                  </G>
                </G>
              ))}
            </> : <Use href={href} transform={lowerPonytail ? "translate(-12 55)" : spriteTransform(frame)} />}
          </G>
          </G>
        );
      })}
    </Svg>
  );
}
