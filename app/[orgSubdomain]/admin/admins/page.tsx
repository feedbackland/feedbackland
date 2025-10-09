"use client";

import { Admins } from "@/components/app/admins";
// import { UpgradeAlert } from "@/components/ui/upgrade-alert";
// import { useSubscription } from "@/hooks/use-subscription";

export default function AdminAdminsPage() {
  return <Admins />;

  // const {
  //   query: { data: subscription, isPending },
  // } = useSubscription();

  // if (subscription && !isPending) {
  //   const { isExpired, name: subscriptionName } = subscription;
  //   const hasAccess = !!(subscriptionName === "pro" && !isExpired);

  //   if (!hasAccess) {
  //     if (isExpired) {
  //       return (
  //         <UpgradeAlert
  //           title="Your subscription is expired"
  //           description="To add and manage multiple admins please update your Feedbackland Cloud Pro subscription."
  //           buttonText="Update subscription"
  //         />
  //       );
  //     }

  //     return (
  //       <UpgradeAlert
  //         title="You free trial has ended"
  //         description="To add and manage multiple admins please upgrade to Feedbackland Cloud Pro."
  //       />
  //     );
  //   }

  //   return <Admins />;
  // }
}
