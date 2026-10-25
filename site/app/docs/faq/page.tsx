import type { Metadata } from "next";
import { FIRST_QUESTIONS, FaqList, MORE_QUESTIONS } from "@/components/Faq";

export const metadata: Metadata = { title: "常见问题" };

export default function Faq() {
  return (
    <>
      <h1>常见问题</h1>
      <h2>项目与数据</h2>
      <FaqList items={FIRST_QUESTIONS} />
      <h2>使用与排查</h2>
      <FaqList items={MORE_QUESTIONS} />
    </>
  );
}
