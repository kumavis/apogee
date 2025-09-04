import { Ref } from "react";
import Card, { sizeMap } from "./Card";
import type { BaseCardProps, CardProps } from "./Card";
import { AutomergeUrl } from "@automerge/react";
import LazyCard from "./LazyCard";
import { FollowPortal } from "../../utils/FollowerSystem";



// // Internal hook for managing the follower state
// const useFloatingWithRedirect = (id: string, altTarget?: AltTarget) => {
//   const targetRef = useSubscribeRef(id);
//   const [isInitiallyPositioned, setIsInitiallyPositioned] = useState(false);
//   const shouldBeVisible = !!targetRef || !!altTarget;
//   const shouldAnimate = shouldBeVisible && isInitiallyPositioned;

//   // useEffect(() => {
//   //   return () => {
//   //     console.log("useFloatingWithRedirect unmounting", id);
//   //   };
//   // }, []);

//   // Configure floating-ui system
//   const { refs, floatingStyles, context, x, y } = useFloating({
//     open: shouldBeVisible,
//     strategy: "fixed",
//     placement: "bottom-start",
//     whileElementsMounted: (reference, floating, update) => {
//       return autoUpdate(reference, floating, update, {
//         // Disable sometimes problematic element resize subscriber
//         elementResize: false,
//       });
//     },
//     middleware: [
//       // Adjust position
//       offset(({ rects }) => ({ mainAxis: -rects.reference.height })),
//     ],
//   });
//   const { status } = useTransitionStatus(context);
//   const isOpen = status === "open";

//   // After the first open, mark as initially positioned
//   useEffect(() => {
//     if (isInitiallyPositioned) return;
//     if (isOpen) {
//       // console.log("useFloatingWithRedirect isOpen", id);
//       setIsInitiallyPositioned(true);
//     }
//   }, [isOpen, isInitiallyPositioned]);

//   // If altTarget is set, set a virtual element as the position reference
//   useEffect(() => {
//     if (altTarget) {
//       const virtualEl = {
//         getBoundingClientRect() {
//           return {
//             x: 0,
//             y: 0,
//             top: altTarget.y,
//             left: altTarget.x,
//             bottom: 0,
//             right: 0,
//             width: 0,
//             height: 0,
//           };
//         },
//       };
//       refs.setPositionReference(virtualEl);
//       return () => refs.setPositionReference(null);
//     } else {
//       const targetElement = targetRef || null;
//       refs.setReference(targetElement);
//     }
//   }, [altTarget, id, targetRef]);


//   // Get the current target element and update the reference
//   // TODO: This is likely unnecessary indirection and the reference could be set directly.
//   useEffect(() => {
//     const targetElement = targetRef;
//     if (targetElement) {
//       refs.setReference(targetElement);
//     }
//   }, [refs, id, targetRef]);

//   return { refs, floatingStyles, x, y, shouldAnimate, shouldBeVisible, isOpen };
// }

// interface SpringFollowerProps {
//   id: string;
//   springConfig?: { stiffness?: number; damping?: number; mass?: number };
//   children: ReactNode;
//   altTarget?: AltTarget;
// }
// // Internal component that follows a target element with inertial springs
// const SpringFollower = ({ id, springConfig, children, altTarget }: SpringFollowerProps) => {
//   const {
//     x: floatingX,
//     y: floatingY,
//     floatingStyles,
//     refs,
//     shouldBeVisible,
//     shouldAnimate,
//   } = useFloatingWithRedirect(id, altTarget);

//   // Inertial springs for smooth movement
//   const stiffness = springConfig?.stiffness ?? 400;
//   const damping = springConfig?.damping ?? 40;
//   const mass = springConfig?.mass ?? 1;
//   const springX = useSpring(floatingX, { stiffness, damping, mass });
//   const springY = useSpring(floatingY, { stiffness, damping, mass });

//   // Update spring targets when Floating UI position changes
//   useEffect(() => {
//     if (typeof floatingX === "number") springX.set(floatingX);
//     if (typeof floatingY === "number") springY.set(floatingY);
//   }, [floatingX, floatingY, springX, springY]);

//   if (!shouldBeVisible) return null;

//   return <motion.div
//     key={id}
//     ref={refs.setFloating}
//     style={{
//       ...floatingStyles,
//       transform: "none",
//       top: springY,
//       left: springX,
//       willChange: "top, left",
//       display: shouldAnimate ? "block" : "none",
//     }}>{children}</motion.div>;
// }

type FloatingCardProps = CardProps & {
  instanceId: string;
  altTarget?: { x: number, y: number };
};
export const FloatingCard: React.FC<FloatingCardProps> = ({
  instanceId,
  altTarget,
  ...cardProps
}) => {

  return (
    <FollowPortal id={instanceId} altTarget={altTarget} TargetComponent={CardSlot} targetProps={cardProps}>
      <Card {...cardProps} />
    </FollowPortal>
  )
}

type LazyFloatingCardProps = BaseCardProps & {
  instanceId: string;
  url: AutomergeUrl;
  altTarget?: { x: number, y: number };
  debugKey?: string;
};
export const LazyFloatingCard: React.FC<LazyFloatingCardProps> = ({
  instanceId,
  altTarget,
  url,
  ...cardProps
}) => {
  return (
    <FollowPortal id={instanceId} altTarget={altTarget} TargetComponent={CardSlot} targetProps={cardProps}>
      <LazyCard url={url} {...cardProps} />
    </FollowPortal>
  )
}


type CardSlotProps = {
  id: string;
  targetRef: Ref<HTMLElement>;
  size?: 'small' | 'medium' | 'large';
  // faceDown?: boolean;
  style?: React.CSSProperties;
  debugKey?: string;
  debugMode?: boolean;
};
export const CardSlot: React.FC<CardSlotProps> = ({
  id,
  targetRef,
  size = 'medium',
  // faceDown = false,
  style = {},
  debugKey = id,
  debugMode = false,
}) => {
  const cardSize = sizeMap[size];

  return (
    <div
      ref={targetRef as Ref<HTMLDivElement>}
      style={{
        width: cardSize.width,
        height: cardSize.height,
        position: 'relative',
        visibility: debugMode ? 'visible' : 'hidden',
        ...style
      }}
    >
      {debugMode ? `slot:${debugKey}` : null}
    </div>
  );
};