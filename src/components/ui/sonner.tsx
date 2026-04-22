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
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:!w-[92vw] group-[.toaster]:!max-w-md group-[.toaster]:!min-h-[80px] group-[.toaster]:!p-5 group-[.toaster]:!text-base group-[.toaster]:!font-bold group-[.toaster]:!rounded-2xl group-[.toaster]:!fixed group-[.toaster]:!top-1/2 group-[.toaster]:!left-1/2 group-[.toaster]:!-translate-x-1/2 group-[.toaster]:!-translate-y-1/2",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:!text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
