"use client";

import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  loginSchema,
  type LoginInput,
  ApiError,
  toFriendlyMessage,
} from "@ledger/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";

interface AuthLoginCardProps {
  title: string;
  subtitle?: string;
  isPending: boolean;
  onSubmit: (values: LoginInput) => Promise<void>;
}

export function AuthLoginCard({
  title,
  subtitle,
  isPending,
  onSubmit,
}: AuthLoginCardProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function handleFormSubmit(values: LoginInput) {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError && error.correlationId) {
        setError("root", {
          message: `${toFriendlyMessage(error)} (Ref: ${error.correlationId})`,
        });
      } else {
        setError("root", { message: toFriendlyMessage(error) });
      }
    }
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8 rounded-xl border p-10 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          )}
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="px-3.5 py-2.5"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              className="px-3.5 py-2.5"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive text-sm">
                {errors.password.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.message}
            </p>
          )}

          <Button
            type="submit"
            className="w-full px-4 py-2.5"
            disabled={isPending}
          >
            {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
