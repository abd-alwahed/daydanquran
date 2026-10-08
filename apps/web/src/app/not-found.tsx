import Link from "next/link";

export default function NotFound() {
  return (
    <section>
      <h1>هذه الصفحة غير متاحة بعد</h1>
      <p>
        <Link href="/">العودة إلى صفحة اليوم</Link>
      </p>
    </section>
  );
}
