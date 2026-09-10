import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

/**
 * Baslikli bolum: Card + CardHeader/CardTitle + CardContent.
 *
 * TCMB gibi cok bolumlu sayfalar bu bolumleri elle `<div className="space-y-3">`
 * + `<h3>` olarak kuruyordu; sonuc, diger sayfalardaki kartlarin yanında
 * yuzeysiz duz kutulardi. Tek bilesen kullanmak butun sayfalarda ayni
 * yuzey/golge/baslik olceginin cikmasini garanti ediyor.
 */
export function Bolum({
  baslik,
  aciklama,
  className,
  children,
}: {
  baslik: React.ReactNode;
  aciklama?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{baslik}</CardTitle>
        {aciklama && <CardDescription>{aciklama}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("space-y-3", className)}>{children}</CardContent>
    </Card>
  );
}
