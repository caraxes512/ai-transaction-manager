from decimal import Decimal

CENT = Decimal("0.01")


def inr(x) -> str:
    """Rupees with Indian digit grouping: 1234567 -> ₹12,34,567; drops .00."""
    d = Decimal(str(x)).quantize(CENT)
    sign = "-" if d < 0 else ""
    d = abs(d)
    whole, frac = divmod(d, 1)
    s = str(int(whole))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts: list[str] = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    cents = int(frac * 100)
    return f"{sign}₹{s}" + (f".{cents:02d}" if cents else "")
