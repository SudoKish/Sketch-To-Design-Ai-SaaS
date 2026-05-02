import { useLazyGetCheckoutQuery } from "@/redux/api/billing";
import { useAppSelector } from "@/redux/store";
import { toast } from "sonner";

export const useSubscriptionPlan = () => {
  const [trigger, { isFetching }] = useLazyGetCheckoutQuery();
  const profile = useAppSelector((state) => state.profile);

  const onSubscribe = async () => {
    if (!profile?.id) {
      toast.error("User profile is not fully loaded yet. Please wait a moment.");
      return;
    }
    try {
      const res = await trigger(profile.id).unwrap();
      // hosted checkout
      window.location.href = res.url;
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Could not start checkout. Please try again.");
    }
  };

  return { onSubscribe, isFetching };
};
