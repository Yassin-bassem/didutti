import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      closeButton
      duration={5000}
      offset="50vh"
      mobileOffset="50vh"
      style={
        {
          "--width": "min(92vw, 28rem)",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:!min-h-[80px] group-[.toaster]:!p-5 group-[.toaster]:!pe-10 group-[.toaster]:!text-base group-[.toaster]:!font-bold group-[.toaster]:!rounded-2xl group-[.toaster]:-translate-y-1/2",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:!text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:!bg-background group-[.toast]:!text-foreground group-[.toast]:!border-border group-[.toast]:!start-auto group-[.toast]:!end-2 group-[.toast]:!top-2 group-[.toast]:!left-auto group-[.toast]:!right-2",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
